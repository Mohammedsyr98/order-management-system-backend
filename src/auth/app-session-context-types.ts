import type { auth } from './auth.js';
import type { TenantRole } from '../contracts/roles.js';

export type { TenantRole };

export type ResolvedAuthContext = {
  userId: string;
  tenantId: string;
  role: TenantRole;
};

export type AuthContextResolution =
  | ResolvedAuthContext
  | null
  | 'missing-membership';

export type AppSessionUser = {
  id: string;
  name: string;
  email: string;
};

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

export type SignInEmailResultWithHeaders = {
  headers: Headers;
  response: Awaited<ReturnType<typeof auth.api.signInEmail>>;
};
