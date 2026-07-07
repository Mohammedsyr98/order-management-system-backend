import type { ApiErrorCode } from '../contracts/api.js';
import type { TenantRole } from '../contracts/roles.js';
import type {
  AppSessionResponse,
  AppSessionUser,
} from '../contracts/session.js';

export type AppSessionContext = {
  tenantId: string;
  tenantName: string;
  role: TenantRole;
};

export type AppSessionResolution =
  | {
      user: AppSessionUser;
      context: AppSessionContext;
    }
  | null
  | 'missing-membership';

export type SessionErrorCode = Extract<
  ApiErrorCode,
  | 'INVALID_LOGIN_REQUEST'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_CONTEXT_FAILED'
  | 'UNAUTHENTICATED'
  | 'TENANT_MEMBERSHIP_REQUIRED'
>;

export type SessionCommandResult =
  | {
      ok: true;
      data: AppSessionResponse;
      setCookieHeaders?: string[];
    }
  | {
      ok: false;
      errorCode: SessionErrorCode;
    };
