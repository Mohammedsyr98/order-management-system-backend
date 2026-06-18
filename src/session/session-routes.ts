import type { Request } from 'express';
import { Router } from 'express';
import { APIError } from 'better-auth';

import { sendApiError } from '../http/api-errors.js';
import {
  resolveSession,
  resolveTenantContext,
  signInWithEmail,
  signOut,
} from '../auth/app-session-context.js';
import type {
  AppSessionContext,
  AppSessionUser,
} from '../auth/app-session-context-types.js';
import type { LoginRequestBody } from './session-types.js';

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

const trySignOut = async (req: Request) => {
  try {
    await signOut(req);
  } catch {
    // Best-effort cleanup after a session wrapper failure.
  }
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

  try {
    const authResult = await signInWithEmail(req, {
      email,
      password: body.password,
    });

    let context: AppSessionContext | undefined;

    try {
      context = await resolveTenantContext(authResult.response.user.id);
    } catch {
      await trySignOut(req);
      sendApiError(res, 500, 'SESSION_CONTEXT_FAILED');
      return;
    }

    if (!context) {
      await trySignOut(req);
      sendApiError(res, 403, 'TENANT_MEMBERSHIP_REQUIRED');
      return;
    }

    for (const cookie of getSetCookieHeaders(authResult.headers)) {
      res.append('set-cookie', cookie);
    }

    res.json(appSessionResponse(authResult.response.user, context));
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
});

sessionRouter.get('/current', async (req, res) => {
  const session = await resolveSession(req);

  if (session === null) {
    sendApiError(res, 401, 'UNAUTHENTICATED');
    return;
  }

  if (session === 'missing-membership') {
    sendApiError(res, 403, 'TENANT_MEMBERSHIP_REQUIRED');
    return;
  }

  res.json(appSessionResponse(session.user, session.context));
});

sessionRouter.post('/logout', async (req, res) => {
  await trySignOut(req);
  res.status(204).end();
});
