export type UpdateTenantProfileRequest = {
  name?: unknown;
  phone?: unknown;
};

export type TenantProfileResponse = {
  tenant: {
    id: string;
    name: string;
    phone: string;
  };
};
