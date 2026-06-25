import { Router, type Response } from 'express';

import {
  requireAuthContext,
  requireManagerAccess,
  requireOwnerAccess,
  requireTenantRole,
  type ResolvedAuthContext,
} from '../auth/auth-context.js';
import type {
  CreateStaffRequest,
  UpdateCourierProfileRequest,
  UpdateManagerProfileRequest,
  UpdateStaffProfileRequest,
} from '../contracts/staff.js';
import { sendApiError } from '../http/api-errors.js';
import {
  createStaff,
  deleteCourier,
  deleteManager,
  listCouriers,
  listManagers,
  updateCourierProfile,
  updateManagerProfile,
  updateOwnStaffProfile,
} from './staff-service.js';
import type {
  DeleteCourierErrorCode,
  DeleteManagerErrorCode,
  StaffCreationErrorCode,
  UpdateStaffProfileErrorCode,
} from './staff-types.js';

export const staffRouter = Router();

const requireStaffSelfAccess = requireTenantRole(['manager', 'courier']);

type StaffRouteErrorCode =
  | StaffCreationErrorCode
  | UpdateStaffProfileErrorCode
  | DeleteManagerErrorCode
  | DeleteCourierErrorCode;

const sendStaffError = (res: Response, errorCode: StaffRouteErrorCode) => {
  const status =
    errorCode === 'INVALID_STAFF_REQUEST'
      ? 400
      : errorCode === 'FORBIDDEN'
        ? 403
        : errorCode === 'STAFF_MANAGER_NOT_FOUND' ||
            errorCode === 'STAFF_COURIER_NOT_FOUND'
          ? 404
          : 422;

  return sendApiError(res, status, errorCode);
};

staffRouter.patch(
  '/me',
  requireAuthContext,
  requireStaffSelfAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const result = await updateOwnStaffProfile(
      context,
      req.body as UpdateStaffProfileRequest
    );

    if (!result.ok) {
      sendStaffError(res, result.errorCode);
      return;
    }

    res.json(result.data);
  }
);

staffRouter.get(
  '/couriers',
  requireAuthContext,
  requireManagerAccess,
  async (_req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const couriers = await listCouriers(context.tenantId);

    res.json(couriers);
  }
);

staffRouter.patch(
  '/couriers/:courierId',
  requireAuthContext,
  requireManagerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const body = req.body as UpdateCourierProfileRequest;
    const { courierId } = req.params;

    if (typeof courierId !== 'string') {
      sendApiError(res, 400, 'INVALID_STAFF_REQUEST');
      return;
    }

    const result = await updateCourierProfile(
      context.tenantId,
      courierId,
      body
    );

    if (!result.ok) {
      sendStaffError(res, result.errorCode);
      return;
    }

    res.json(result.data);
  }
);

staffRouter.delete(
  '/couriers/:courierId',
  requireAuthContext,
  requireManagerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const { courierId } = req.params;

    if (typeof courierId !== 'string') {
      sendApiError(res, 400, 'INVALID_STAFF_REQUEST');
      return;
    }

    const result = await deleteCourier(context.tenantId, courierId);

    if (!result.ok) {
      sendStaffError(res, result.errorCode);
      return;
    }

    res.status(204).end();
  }
);

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
      sendStaffError(res, result.errorCode);
      return;
    }

    res.json(result.data);
  }
);

staffRouter.delete(
  '/managers/:managerId',
  requireAuthContext,
  requireOwnerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const { managerId } = req.params;

    if (typeof managerId !== 'string') {
      sendApiError(res, 400, 'INVALID_STAFF_REQUEST');
      return;
    }

    const result = await deleteManager(context.tenantId, managerId);

    if (!result.ok) {
      sendStaffError(res, result.errorCode);
      return;
    }

    res.status(204).end();
  }
);

staffRouter.post('/', requireAuthContext, async (req, res) => {
  const body = req.body as CreateStaffRequest;
  const result = await createStaff(
    res.locals.authContext as ResolvedAuthContext,
    body
  );

  if (!result.ok) {
    sendStaffError(res, result.errorCode);
    return;
  }

  res.status(201).json(result.data);
});
