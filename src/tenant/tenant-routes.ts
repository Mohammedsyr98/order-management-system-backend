import { Router } from 'express';

import {
  requireAuthContext,
  requireOwnerAccess,
  type ResolvedAuthContext,
} from '../auth/auth-context.js';
import type { UpdateTenantProfileRequest } from '../contracts/tenant.js';
import { sendApiError } from '../http/api-errors.js';
import { updateTenantProfile } from './tenant-service.js';

export const tenantRouter = Router();

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
      const status = result.errorCode === 'INVALID_TENANT_PROFILE' ? 400 : 422;

      sendApiError(res, status, result.errorCode);
      return;
    }

    res.json(result.data);
  }
);
