import type { Request } from 'express';
import { eq } from 'drizzle-orm';

import { auth } from './auth.js';
import type {
  AppSessionContext,
  AppSessionResolution,
  AuthContextResolution,
  SignInEmailResultWithHeaders,
} from './app-session-context-types.js';
import { db } from '../db/index.js';
import { tenants, tenantUsers } from '../db/schema.js';

type HeaderValue = Request['headers'][string];

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

export const signInWithEmail = async (
  req: Request,
  body: { email: string; password: string }
): Promise<SignInEmailResultWithHeaders> =>
  auth.api.signInEmail({
    body,
    headers: headersFromRequest(req),
    returnHeaders: true,
  });

export const signOut = async (req: Request) => {
  await auth.api.signOut({ headers: headersFromRequest(req) });
};

export const resolveTenantContext = async (
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

export const resolveAuthContext = async (
  req: Request
): Promise<AuthContextResolution> => {
  const session = await resolveSession(req);

  if (session === null || session === 'missing-membership') {
    return session;
  }

  return {
    userId: session.user.id,
    tenantId: session.context.tenantId,
    role: session.context.role,
  };
};
