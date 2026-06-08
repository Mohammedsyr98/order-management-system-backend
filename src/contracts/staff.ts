import type { StaffRole } from './roles.js';

export type CreateStaffRole = StaffRole;

export type CreateStaffRequest = {
  name: string;
  email: string;
  password: string;
  role: CreateStaffRole;
  phone?: string | null;
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
    phone: string | null;
  };
};

export type ManagerListItem = {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  role: 'manager';
  phone: string | null;
};

export type ListManagersResponse = {
  managers: ManagerListItem[];
};

export type UpdateManagerProfileRequest = {
  name?: string;
  phone?: string | null;
};

export type UpdateManagerProfileResponse = {
  manager: ManagerListItem;
};
