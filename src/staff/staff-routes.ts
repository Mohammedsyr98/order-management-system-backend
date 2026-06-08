import { Router } from 'express';

import {
  requireAuthContext,
  requireOwnerAccess,
  type ResolvedAuthContext,
} from '../auth/auth-context.js';
import type {
  CreateStaffRequest,
  UpdateManagerProfileRequest,
} from '../contracts/staff.js';
import { sendApiError } from '../http/api-errors.js';
import {
  createStaff,
  listManagers,
  updateManagerProfile,
} from './staff-service.js';
import type { UpdateManagerProfileErrorCode } from './staff-types.js';

export const staffRouter = Router();

const updateManagerProfileStatus = (
  errorCode: UpdateManagerProfileErrorCode
) =>
  errorCode === 'INVALID_STAFF_REQUEST'
    ? 400
    : errorCode === 'STAFF_MANAGER_NOT_FOUND'
      ? 404
      : 422;

staffRouter.get(
  '/managers',
  requireAuthContext,
  requireOwnerAccess,
  async (_req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const managers = await listManagers(context.tenantId);

    res.json(managers);
  }
);

staffRouter.patch(
  '/managers/:managerId',
  requireAuthContext,
  requireOwnerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const body = req.body as UpdateManagerProfileRequest;
    const { managerId } = req.params;

    if (typeof managerId !== 'string') {
      sendApiError(res, 400, 'INVALID_STAFF_REQUEST');
      return;
    }

    const result = await updateManagerProfile(
      context.tenantId,
      managerId,
      body
    );

    if (!result.ok) {
      sendApiError(
        res,
        updateManagerProfileStatus(result.errorCode),
        result.errorCode
      );
      return;
    }

    res.json(result.data);
  }
);

staffRouter.post('/', requireAuthContext, async (req, res) => {
  const body = req.body as CreateStaffRequest;
  const result = await createStaff(
    res.locals.authContext as ResolvedAuthContext,
    body
  );

  if (!result.ok) {
    const status =
      result.errorCode === 'INVALID_STAFF_REQUEST'
        ? 400
        : result.errorCode === 'FORBIDDEN'
          ? 403
          : 422;

    sendApiError(res, status, result.errorCode);
    return;
  }

  res.status(201).json(result.data);
});
