import type { ApiErrorCode } from '../contracts/api.js';
import type { CreateStaffResponse } from '../contracts/staff.js';

export type StaffCreationErrorCode = Extract<
  ApiErrorCode,
  'INVALID_STAFF_ROLE' | 'STAFF_EMAIL_ALREADY_EXISTS' | 'STAFF_CREATION_FAILED'
>;

export type CreateStaffResult =
  | { ok: true; data: CreateStaffResponse }
  | { ok: false; errorCode: StaffCreationErrorCode };
