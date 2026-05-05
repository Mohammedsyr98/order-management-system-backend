import type { Response } from 'express';

import type { ApiErrorCode, ApiErrorResponse } from '../contracts/api.js';

export const apiErrorMessages: Record<ApiErrorCode, string> = {
  UNAUTHENTICATED: 'You must sign in to perform this action.',
  TENANT_MEMBERSHIP_REQUIRED:
    'Your account is not linked to a tenant. Contact support for help.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  INVALID_STAFF_ROLE: 'Staff role must be manager or courier.',
  STAFF_EMAIL_ALREADY_EXISTS: 'A user with this email already exists.',
  STAFF_CREATION_FAILED: 'Staff account could not be created.',
};

export const apiError = (code: ApiErrorCode): ApiErrorResponse => ({
  error: {
    code,
    message: apiErrorMessages[code],
  },
});

export const sendApiError = (
  res: Response,
  status: number,
  code: ApiErrorCode
) => res.status(status).json(apiError(code));
