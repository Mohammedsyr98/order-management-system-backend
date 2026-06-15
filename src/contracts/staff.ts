import type { StaffRole } from './roles.js';

export type CreateStaffRole = StaffRole;

type CreateStaffBaseRequest = {
  name: string;
  email: string;
  password: string;
};

export type CreateManagerRequest = CreateStaffBaseRequest & {
  role: 'manager';
  phone?: string | null;
};

export type CreateCourierRequest = CreateStaffBaseRequest & {
  role: 'courier';
  phone: string;
};

export type CreateStaffRequest = CreateManagerRequest | CreateCourierRequest;

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

export type StaffProfile = {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  role: StaffRole;
  phone: string | null;
};

export type ManagerListItem = StaffProfile & {
  role: 'manager';
};

export type ListManagersResponse = {
  managers: ManagerListItem[];
};

export type CourierListItem = StaffProfile & {
  role: 'courier';
};

export type ListCouriersResponse = {
  couriers: CourierListItem[];
};

export type UpdateStaffProfileRequest = {
  name?: string;
  phone?: string | null;
};

export type UpdateStaffProfileResponse = {
  staff: StaffProfile;
};

export type UpdateManagerProfileRequest = UpdateStaffProfileRequest;

export type UpdateManagerProfileResponse = {
  manager: ManagerListItem;
};
