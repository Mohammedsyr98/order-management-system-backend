import type { ApiErrorCode } from '../contracts/api.js';
import type {
  CreateStaffResponse,
  UpdateManagerProfileResponse,
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
