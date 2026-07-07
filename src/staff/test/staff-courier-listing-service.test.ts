import { beforeEach, describe, expect, it } from 'vitest';
import 'dotenv/config';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for staff-courier-listing-service.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const {
  insertTenant,
  insertTenantMembership,
  insertUser,
  resetTenantTestData,
} = await import('../../test/test-db.js');
const { listCouriers } = await import('../staff-service.js');

describe('listCouriers', () => {
  beforeEach(async () => {
    await resetTenantTestData();
  });

  it('lists only couriers in the authenticated tenant with identity and membership data', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertUser({
      id: 'courier-2',
      name: 'Beta Courier',
      email: 'beta@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-courier-2',
      userId: 'courier-2',
      role: 'courier',
      phone: null,
    });
    await insertUser({
      id: 'courier-1',
      name: 'Alpha Courier',
      email: 'alpha@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-courier-1',
      userId: 'courier-1',
      role: 'courier',
      phone: '+15557654321',
    });
    await insertUser({
      id: 'manager-1',
      name: 'Manager User',
      email: 'manager@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-manager-1',
      userId: 'manager-1',
      role: 'manager',
      phone: '+15551234567',
    });
    await insertUser({
      id: 'other-tenant-courier-1',
      name: 'Other Tenant Courier',
      email: 'other@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-other-courier-1',
      tenantId: 'tenant-2',
      userId: 'other-tenant-courier-1',
      role: 'courier',
      phone: '+15550000002',
    });

    await expect(listCouriers('tenant-1')).resolves.toEqual({
      couriers: [
        {
          id: 'courier-1',
          name: 'Alpha Courier',
          email: 'alpha@example.com',
          tenantId: 'tenant-1',
          role: 'courier',
          phone: '+15557654321',
        },
        {
          id: 'courier-2',
          name: 'Beta Courier',
          email: 'beta@example.com',
          tenantId: 'tenant-1',
          role: 'courier',
          phone: null,
        },
      ],
    });
  });
});
