import { Router } from 'express';

import {
  requireAuthContext,
  type ResolvedAuthContext,
} from '../auth/auth-context.js';
import type { CreateStaffRequest } from '../contracts/staff.js';
import { sendApiError } from '../http/api-errors.js';
import { createStaff } from './staff-service.js';

export const staffRouter = Router();

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
