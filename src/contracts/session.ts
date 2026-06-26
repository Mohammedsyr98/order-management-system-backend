import type { TenantRole } from './roles.js';

export type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

export type AppSessionUser = {
  id: string;
  name: string;
  email: string;
};

export type AppSessionResponse = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  tenant: {
    id: string;
    name: string;
  };
  membership: {
    role: TenantRole;
  };
};
