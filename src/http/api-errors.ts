import type { Response } from 'express';

import type { ApiErrorCode, ApiErrorResponse } from '../contracts/api.js';

export const apiErrorMessages: Record<ApiErrorCode, string> = {
  UNAUTHENTICATED: 'You must sign in to perform this action.',
  TENANT_MEMBERSHIP_REQUIRED:
    'Your account is not linked to a tenant. Contact support for help.',
  INVALID_LOGIN_REQUEST: 'Email and password are required.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  SESSION_CONTEXT_FAILED: 'Session context could not be resolved.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  TENANT_PROFILE_NOT_FOUND: 'Tenant profile could not be found.',
  INVALID_TENANT_PROFILE: 'Tenant profile update is invalid.',
  TENANT_UPDATE_FAILED: 'Tenant profile could not be updated.',
  INVALID_STAFF_REQUEST: 'Staff request is invalid.',
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
