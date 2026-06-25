import type { Request } from 'express';
import { APIError } from 'better-auth';
import { eq } from 'drizzle-orm';

import { auth } from '../auth/auth.js';
import { db } from '../db/index.js';
import { tenants, tenantUsers } from '../db/schema.js';
import type {
  AppSessionContext,
  AppSessionResolution,
  AppSessionResponse,
  AppSessionUser,
  LoginRequestBody,
  SessionCommandResult,
} from './session-types.js';

type HeaderValue = Request['headers'][string];
type SignInEmailResultWithHeaders = {
  headers: Headers;
  response: Awaited<ReturnType<typeof auth.api.signInEmail>>;
};

const appendHeader = (headers: Headers, name: string, value: HeaderValue) => {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      headers.append(name, item);
    }
    return;
  }

  headers.set(name, value);
};

const headersFromRequest = (req: Request) => {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    appendHeader(headers, name, value);
  }

  return headers;
};

const signInWithEmail = async (
  req: Request,
  body: { email: string; password: string }
): Promise<SignInEmailResultWithHeaders> =>
  auth.api.signInEmail({
    body,
    headers: headersFromRequest(req),
    returnHeaders: true,
  });

const signOut = async (req: Request) => {
  try {
    await auth.api.signOut({ headers: headersFromRequest(req) });
  } catch {
    // Best-effort cleanup after a session wrapper failure.
  }
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

const appSessionResponse = (
  user: AppSessionUser,
  context: AppSessionContext
): AppSessionResponse => ({
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

const resolveTenantContext = async (
  userId: string
): Promise<AppSessionContext | undefined> => {
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

  return context;
};

export const resolveSession = async (
  req: Request
): Promise<AppSessionResolution> => {
  const session = await auth.api.getSession({
    headers: headersFromRequest(req),
  });

  if (!session) {
    return null;
  }

  const context = await resolveTenantContext(session.user.id);

  if (!context) {
    return 'missing-membership';
  }

  return {
    user: session.user,
    context,
  };
};

export const loginSession = async (
  req: Request,
  body: LoginRequestBody | undefined = {}
): Promise<SessionCommandResult> => {
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || typeof body.password !== 'string' || !body.password) {
    return {
      ok: false,
      errorCode: 'INVALID_LOGIN_REQUEST',
    };
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
      await signOut(req);
      return {
        ok: false,
        errorCode: 'SESSION_CONTEXT_FAILED',
      };
    }

    if (!context) {
      await signOut(req);
      return {
        ok: false,
        errorCode: 'TENANT_MEMBERSHIP_REQUIRED',
      };
    }

    return {
      ok: true,
      setCookieHeaders: getSetCookieHeaders(authResult.headers),
      data: appSessionResponse(authResult.response.user, context),
    };
  } catch (error) {
    if (error instanceof APIError) {
      if (error.status === 'BAD_REQUEST' || error.statusCode === 400) {
        return {
          ok: false,
          errorCode: 'INVALID_LOGIN_REQUEST',
        };
      }

      return {
        ok: false,
        errorCode: 'INVALID_CREDENTIALS',
      };
    }

    throw error;
  }
};

export const getCurrentSession = async (
  req: Request
): Promise<SessionCommandResult> => {
  const session = await resolveSession(req);

  if (session === null) {
    return {
      ok: false,
      errorCode: 'UNAUTHENTICATED',
    };
  }

  if (session === 'missing-membership') {
    return {
      ok: false,
      errorCode: 'TENANT_MEMBERSHIP_REQUIRED',
    };
  }

  return {
    ok: true,
    data: appSessionResponse(session.user, session.context),
  };
};

export const logoutSession = async (req: Request) => {
  await signOut(req);
};
