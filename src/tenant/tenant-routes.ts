import { Router } from 'express';

import {
  requireAuthContext,
  requireOwnerAccess,
  type ResolvedAuthContext,
} from '../auth/auth-context.js';
import type { UpdateTenantProfileRequest } from '../contracts/tenant.js';
import { sendApiError } from '../http/api-errors.js';
import { getTenantProfile, updateTenantProfile } from './tenant-service.js';
import type { UpdateTenantProfileErrorCode } from './tenant-types.js';

export const tenantRouter = Router();

const updateTenantProfileStatus = (errorCode: UpdateTenantProfileErrorCode) =>
  errorCode === 'INVALID_TENANT_PROFILE' ? 400 : 422;

tenantRouter.get('/', requireAuthContext, async (_req, res) => {
  const context = res.locals.authContext as ResolvedAuthContext;
  const result = await getTenantProfile(context.tenantId);

  if (!result.ok) {
    sendApiError(res, 404, result.errorCode);
    return;
  }

  res.json(result.data);
});

tenantRouter.patch(
  '/',
  requireAuthContext,
  requireOwnerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const result = await updateTenantProfile(
      context.tenantId,
      req.body as UpdateTenantProfileRequest
    );

    if (!result.ok) {
      sendApiError(
        res,
        updateTenantProfileStatus(result.errorCode),
        result.errorCode
      );
      return;
    }

    res.json(result.data);
  }
);
