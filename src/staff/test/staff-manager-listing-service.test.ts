import { beforeEach, describe, expect, it } from 'vitest';
import 'dotenv/config';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for staff-manager-listing-service.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const {
  insertTenant,
  insertTenantMembership,
  insertUser,
  resetTenantTestData,
} = await import('../../test/test-db.js');
const { listManagers } = await import('../staff-service.js');

describe('listManagers', () => {
  beforeEach(async () => {
    await resetTenantTestData();
  });

  it('lists only managers in the authenticated tenant with identity and membership data', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertUser({
      id: 'manager-2',
      name: 'Beta Manager',
      email: 'beta@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-manager-2',
      userId: 'manager-2',
      role: 'manager',
      phone: null,
    });
    await insertUser({
      id: 'manager-1',
      name: 'Alpha Manager',
      email: 'alpha@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-manager-1',
      userId: 'manager-1',
      role: 'manager',
      phone: '+15551234567',
    });
    await insertUser({
      id: 'courier-1',
      name: 'Courier User',
      email: 'courier@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-courier-1',
      userId: 'courier-1',
      role: 'courier',
      phone: '+15557654321',
    });
    await insertUser({
      id: 'other-tenant-manager-1',
      name: 'Other Tenant Manager',
      email: 'other@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-other-manager-1',
      tenantId: 'tenant-2',
      userId: 'other-tenant-manager-1',
      role: 'manager',
      phone: '+15550000002',
    });

    await expect(listManagers('tenant-1')).resolves.toEqual({
      managers: [
        {
          id: 'manager-1',
          name: 'Alpha Manager',
          email: 'alpha@example.com',
          tenantId: 'tenant-1',
          role: 'manager',
          phone: '+15551234567',
        },
        {
          id: 'manager-2',
          name: 'Beta Manager',
          email: 'beta@example.com',
          tenantId: 'tenant-1',
          role: 'manager',
          phone: null,
        },
      ],
    });
  });
});
