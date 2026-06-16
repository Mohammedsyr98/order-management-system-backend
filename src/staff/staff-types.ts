import type { ApiErrorCode } from '../contracts/api.js';
import type {
  CreateStaffResponse,
  UpdateCourierProfileResponse,
  UpdateManagerProfileResponse,
  UpdateStaffProfileResponse,
} from '../contracts/staff.js';

export type StaffCreationErrorCode = Extract<
  ApiErrorCode,
  | 'INVALID_STAFF_REQUEST'
  | 'FORBIDDEN'
  | 'STAFF_EMAIL_ALREADY_EXISTS'
  | 'STAFF_CREATION_FAILED'
>;

export type CreateStaffResult =
  | { ok: true; data: CreateStaffResponse }
  | { ok: false; errorCode: StaffCreationErrorCode };

export type UpdateManagerProfileErrorCode = Extract<
  ApiErrorCode,
  'INVALID_STAFF_REQUEST' | 'STAFF_MANAGER_NOT_FOUND' | 'STAFF_UPDATE_FAILED'
>;

export type UpdateManagerProfileResult =
  | { ok: true; data: UpdateManagerProfileResponse }
  | { ok: false; errorCode: UpdateManagerProfileErrorCode };

export type UpdateCourierProfileErrorCode = Extract<
  ApiErrorCode,
  'INVALID_STAFF_REQUEST' | 'STAFF_COURIER_NOT_FOUND' | 'STAFF_UPDATE_FAILED'
>;

export type UpdateCourierProfileResult =
  | { ok: true; data: UpdateCourierProfileResponse }
  | { ok: false; errorCode: UpdateCourierProfileErrorCode };

export type UpdateStaffProfileErrorCode =
  | UpdateManagerProfileErrorCode
  | UpdateCourierProfileErrorCode;

export type UpdateStaffProfileResult =
  | { ok: true; data: UpdateStaffProfileResponse }
  | { ok: false; errorCode: UpdateStaffProfileErrorCode };

export type DeleteManagerErrorCode = Extract<
  ApiErrorCode,
  'STAFF_MANAGER_NOT_FOUND' | 'STAFF_DELETE_FAILED'
>;

export type DeleteManagerResult =
  | { ok: true }
  | { ok: false; errorCode: DeleteManagerErrorCode };
