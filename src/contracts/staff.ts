import type { StaffRole } from './roles.js';

export type CreateStaffRole = StaffRole;

export type CreateStaffRequest = {
  name: string;
  email: string;
  password: string;
  role: CreateStaffRole;
};

export type CreateStaffResponse = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  membership: {
    tenantId: string;
    role: CreateStaffRole;
  };
};
