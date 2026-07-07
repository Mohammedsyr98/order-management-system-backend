import { beforeEach, describe, expect, it } from 'vitest';
import 'dotenv/config';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for staff-courier-listing-service.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { insertTenant, resetTenantTestData } =
  await import('../../test/test-db.js');
const { insertStaffMember } = await import('./test-support.js');
const { listCouriers } = await import('../staff-service.js');

describe('listCouriers', () => {
  beforeEach(async () => {
    await resetTenantTestData();
  });

  it('lists only couriers in the authenticated tenant with identity and membership data', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertStaffMember({
      id: 'courier-2',
      name: 'Beta Courier',
      email: 'beta@example.com',
      role: 'courier',
      phone: null,
    });
    await insertStaffMember({
      id: 'courier-1',
      name: 'Alpha Courier',
      email: 'alpha@example.com',
      role: 'courier',
      phone: '+15557654321',
    });
    await insertStaffMember({
      id: 'manager-1',
      name: 'Manager User',
      email: 'manager@example.com',
      role: 'manager',
      phone: '+15551234567',
    });
    await insertStaffMember({
      id: 'other-tenant-courier-1',
      name: 'Other Tenant Courier',
      email: 'other@example.com',
      tenantId: 'tenant-2',
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
