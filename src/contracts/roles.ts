export const TENANT_ROLES = ['owner', 'manager', 'courier'] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const STAFF_ROLES = ['manager', 'courier'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const isStaffRole = (role: unknown): role is StaffRole =>
  typeof role === 'string' && STAFF_ROLES.includes(role as StaffRole);
