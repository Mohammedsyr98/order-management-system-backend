import type { ApiErrorCode } from '../contracts/api.js';
import type { TenantProfileResponse } from '../contracts/tenant.js';

export type TenantProfileErrorCode = Extract<
  ApiErrorCode,
  'TENANT_PROFILE_NOT_FOUND'
>;

export type UpdateTenantProfileErrorCode = Extract<
  ApiErrorCode,
  'INVALID_TENANT_PROFILE' | 'TENANT_UPDATE_FAILED'
>;

export type TenantProfileResult =
  | {
      ok: true;
      data: TenantProfileResponse;
    }
  | {
      ok: false;
      errorCode: TenantProfileErrorCode;
    };

export type UpdateTenantProfileResult =
  | {
      ok: true;
      data: TenantProfileResponse;
    }
  | {
      ok: false;
      errorCode: UpdateTenantProfileErrorCode;
    };
