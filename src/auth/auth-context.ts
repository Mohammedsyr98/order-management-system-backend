import type { NextFunction, Request, Response } from 'express';

import type {
  AuthContextResolution,
  ResolvedAuthContext,
  TenantRole,
} from './app-session-context-types.js';
import { resolveAuthContext as resolveRequestAuthContext } from './app-session-context.js';
import { sendApiError } from '../http/api-errors.js';

export type { AuthContextResolution, ResolvedAuthContext, TenantRole };

export const resolveAuthContext = async (
  req: Request
): Promise<AuthContextResolution> => {
  return resolveRequestAuthContext(req);
};

export const requireAuthContext = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const context = await resolveAuthContext(req);

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
