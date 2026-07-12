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
  STAFF_COURIER_NOT_FOUND: 'Courier could not be found.',
  STAFF_MANAGER_NOT_FOUND: 'Manager could not be found.',
  STAFF_EMAIL_ALREADY_EXISTS: 'A user with this email already exists.',
  STAFF_UPDATE_FAILED: 'Staff account could not be updated.',
  STAFF_DELETE_FAILED: 'Staff account could not be deleted.',
  STAFF_CREATION_FAILED: 'Staff account could not be created.',
  INVALID_MENU_CATEGORY_REQUEST: 'Menu category request is invalid.',
  MENU_CATEGORY_NOT_FOUND: 'Menu category could not be found.',
  MENU_CATEGORY_NAME_ALREADY_EXISTS:
    'A menu category with this name already exists.',
  MENU_CATEGORY_CREATE_FAILED: 'Menu category could not be created.',
  MENU_CATEGORY_UPDATE_FAILED: 'Menu category could not be updated.',
  MENU_CATEGORY_DELETE_FAILED: 'Menu category could not be deleted.',
  INVALID_MENU_PRODUCT_REQUEST: 'Menu product request is invalid.',
  MENU_PRODUCT_NOT_FOUND: 'Menu product could not be found.',
  MENU_PRODUCT_NAME_ALREADY_EXISTS:
    'A menu product with this name already exists in this category.',
  MENU_PRODUCT_CREATE_FAILED: 'Menu product could not be created.',
  MENU_PRODUCT_UPDATE_FAILED: 'Menu product could not be updated.',
  MENU_PRODUCT_DELETE_FAILED: 'Menu product could not be deleted.',
  INVALID_MENU_ADD_ON_GROUP_REQUEST: 'Menu add-on group request is invalid.',
  MENU_ADD_ON_GROUP_NOT_FOUND: 'Menu add-on group could not be found.',
  MENU_ADD_ON_GROUP_NAME_ALREADY_EXISTS:
    'A menu add-on group with this name already exists.',
  MENU_ADD_ON_GROUP_CREATE_FAILED: 'Menu add-on group could not be created.',
  MENU_ADD_ON_GROUP_UPDATE_FAILED: 'Menu add-on group could not be updated.',
  MENU_ADD_ON_GROUP_DELETE_FAILED: 'Menu add-on group could not be deleted.',
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
