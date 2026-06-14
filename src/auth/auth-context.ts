import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';

import { auth } from './auth.js';
import { db } from '../db/index.js';
import { tenantUsers } from '../db/schema.js';
import { sendApiError } from '../http/api-errors.js';

export type ResolvedAuthContext = {
  userId: string;
  tenantId: string;
  role: 'owner' | 'manager' | 'courier';
};

export type TenantRole = ResolvedAuthContext['role'];

export type AuthContextResolution =
  | ResolvedAuthContext
  | null
  | 'missing-membership';

type HeaderValue = string | string[] | undefined;

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

export const resolveAuthContext = async (
  headers: Headers
): Promise<AuthContextResolution> => {
  const session = await auth.api.getSession({ headers });

  if (!session) {
    return null;
  }

  const [membership] = await db
    .select({
      tenantId: tenantUsers.tenantId,
      role: tenantUsers.role,
    })
    .from(tenantUsers)
    .where(eq(tenantUsers.userId, session.user.id))
    .limit(1);

  if (!membership) {
    return 'missing-membership';
  }

  return {
    userId: session.user.id,
    tenantId: membership.tenantId,
    role: membership.role,
  };
};

export const requireAuthContext = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const context = await resolveAuthContext(headersFromRequest(req));

  if (context === null) {
    sendApiError(res, 401, 'UNAUTHENTICATED');
    return;
  }

  if (context === 'missing-membership') {
    sendApiError(res, 403, 'TENANT_MEMBERSHIP_REQUIRED');
    return;
  }

  res.locals.authContext = context;
  next();
};

export const requireTenantRole =
  (allowedRoles: readonly TenantRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const context = res.locals.authContext as ResolvedAuthContext | undefined;

    if (!context) {
      sendApiError(res, 401, 'UNAUTHENTICATED');
      return;
    }

    if (!allowedRoles.includes(context.role)) {
      sendApiError(res, 403, 'FORBIDDEN');
      return;
    }

    next();
  };

export const requireManagerAccess = requireTenantRole(['owner', 'manager']);
export const requireOwnerAccess = requireTenantRole(['owner']);
