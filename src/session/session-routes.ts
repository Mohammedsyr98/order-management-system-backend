import type { Request } from 'express';
import { Router } from 'express';
import { APIError } from 'better-auth';
import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { tenants, tenantUsers } from '../db/schema.js';
import { sendApiError } from '../http/api-errors.js';
import { auth } from '../auth/auth.js';
import type {
  AppSessionContext,
  AppSessionUser,
  LoginRequestBody,
  SignInEmailResultWithHeaders,
} from './session-types.js';

const headersFromRequest = (req: Request) => {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
      continue;
    }

    headers.set(name, value);
  }

  return headers;
};

const getSetCookieHeaders = (headers: Headers) => {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  return (
    withGetSetCookie.getSetCookie?.() ??
    [headers.get('set-cookie')].filter(
      (header): header is string => header !== null
    )
  );
};

const trySignOut = async (headers: Headers) => {
  try {
    await auth.api.signOut({ headers });
  } catch {
    // Best-effort cleanup after a session wrapper failure.
  }
};

const resolveAppSessionContext = async (userId: string) => {
  const [context] = await db
    .select({
      tenantId: tenantUsers.tenantId,
      tenantName: tenants.name,
      role: tenantUsers.role,
    })
    .from(tenantUsers)
    .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
    .where(eq(tenantUsers.userId, userId))
    .limit(1);

  return context satisfies AppSessionContext | undefined;
};

const appSessionResponse = (
  user: AppSessionUser,
  context: AppSessionContext
) => ({
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
  },
  tenant: {
    id: context.tenantId,
    name: context.tenantName,
  },
  membership: {
    role: context.role,
  },
});

export const sessionRouter = Router();

sessionRouter.post('/login', async (req, res) => {
  const body = req.body as LoginRequestBody;
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || typeof body.password !== 'string' || !body.password) {
    sendApiError(res, 400, 'INVALID_LOGIN_REQUEST');
    return;
  }

  let authResult: SignInEmailResultWithHeaders;

  try {
    authResult = await auth.api.signInEmail({
      body: {
        email,
        password: body.password,
      },
      headers: headersFromRequest(req),
      returnHeaders: true,
    });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.status === 'BAD_REQUEST' || error.statusCode === 400) {
        sendApiError(res, 400, 'INVALID_LOGIN_REQUEST');
        return;
      }

      sendApiError(res, 401, 'INVALID_CREDENTIALS');
      return;
    }

    throw error;
  }

  const requestHeaders = headersFromRequest(req);

  let context: AppSessionContext | undefined;

  try {
    context = await resolveAppSessionContext(authResult.response.user.id);
  } catch {
    await trySignOut(requestHeaders);
    sendApiError(res, 500, 'SESSION_CONTEXT_FAILED');
    return;
  }

  if (!context) {
    await trySignOut(requestHeaders);
    sendApiError(res, 403, 'TENANT_MEMBERSHIP_REQUIRED');
    return;
  }

  for (const cookie of getSetCookieHeaders(authResult.headers)) {
    res.append('set-cookie', cookie);
  }

  res.json(appSessionResponse(authResult.response.user, context));
});

sessionRouter.get('/current', async (req, res) => {
  const session = await auth.api.getSession({
    headers: headersFromRequest(req),
  });

  if (!session) {
    sendApiError(res, 401, 'UNAUTHENTICATED');
    return;
  }

  const context = await resolveAppSessionContext(session.user.id);

  if (!context) {
    sendApiError(res, 403, 'TENANT_MEMBERSHIP_REQUIRED');
    return;
  }

  res.json(appSessionResponse(session.user, context));
});

sessionRouter.post('/logout', async (req, res) => {
  await trySignOut(headersFromRequest(req));
  res.status(204).end();
});
