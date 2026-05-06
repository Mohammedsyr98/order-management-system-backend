import type { ApiErrorCode } from '../contracts/api.js';
import type { TenantProfileResponse } from '../contracts/tenant.js';

export type UpdateTenantProfileResult =
  | {
      ok: true;
      data: TenantProfileResponse;
    }
  | {
      ok: false;
      errorCode: Extract<
        ApiErrorCode,
        'INVALID_TENANT_PROFILE' | 'TENANT_UPDATE_FAILED'
      >;
    };
