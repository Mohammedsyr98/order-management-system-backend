import {
  defaultOperatingHours,
  defaultTenantTimezone,
} from '../contracts/tenant.js';
import { db } from '../db/index.js';
import {
  menuAddOnGroups,
  menuAddOnItems,
  menuCategories,
  menuProductAddOnGroups,
  menuProductPricingChoices,
  menuProducts,
  tenantUsers,
  tenants,
  user as authUsers,
} from '../db/schema.js';

type TenantInsert = typeof tenants.$inferInsert;
type TenantUserInsert = typeof tenantUsers.$inferInsert;
type UserInsert = typeof authUsers.$inferInsert;

const assertTestDatabaseUrl = () => {
  const databaseUrl = process.env.DATABASE_URL;
  const testDatabaseUrl = process.env.DATABASE_URL_TEST;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set before using test DB helpers.');
  }

  if (!testDatabaseUrl) {
    throw new Error(
      'DATABASE_URL_TEST must be set before using test DB helpers.'
    );
  }

  if (databaseUrl !== testDatabaseUrl) {
    throw new Error(
      'Refusing to clean database because DATABASE_URL does not match DATABASE_URL_TEST.'
    );
  }
};

export const resetTenantTestData = async () => {
  assertTestDatabaseUrl();

  await db.delete(menuProductAddOnGroups);
  await db.delete(menuAddOnItems);
  await db.delete(menuAddOnGroups);
  await db.delete(menuProductPricingChoices);
  await db.delete(menuProducts);
  await db.delete(menuCategories);
  await db.delete(tenantUsers);
  await db.delete(tenants);
  await db.delete(authUsers);
};

export const insertTenant = async (
  overrides: Partial<TenantInsert> = {}
): Promise<TenantInsert> => {
  const tenant: TenantInsert = {
    id: 'tenant-1',
    name: 'Main Tenant',
    phone: '+15550000000',
    timezone: defaultTenantTimezone,
    operatingHours: defaultOperatingHours,
    ...overrides,
  };

  await db.insert(tenants).values(tenant);

  return tenant;
};

export const insertUser = async (
  overrides: Partial<UserInsert> = {}
): Promise<UserInsert> => {
  const user: UserInsert = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    ...overrides,
  };

  await db.insert(authUsers).values(user);

  return user;
};

export const insertTenantMembership = async (
  overrides: Partial<TenantUserInsert> = {}
): Promise<TenantUserInsert> => {
  const membership: TenantUserInsert = {
    id: 'tenant-user-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    role: 'owner',
    ...overrides,
  };

  await db.insert(tenantUsers).values(membership);

  return membership;
};
