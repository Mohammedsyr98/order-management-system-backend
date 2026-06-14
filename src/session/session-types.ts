import type { TenantRole } from '../contracts/roles.js';
import type { auth } from '../auth/auth.js';

export type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

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

export type SignInEmailResultWithHeaders = {
  headers: Headers;
  response: Awaited<ReturnType<typeof auth.api.signInEmail>>;
};
