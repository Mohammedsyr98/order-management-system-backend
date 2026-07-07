import { beforeEach, describe, expect, it } from 'vitest';
import 'dotenv/config';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for staff-manager-listing-service.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { insertTenant, resetTenantTestData } =
  await import('../../test/test-db.js');
const { insertStaffMember } = await import('./test-support.js');
const { listManagers } = await import('../staff-service.js');

describe('listManagers', () => {
  beforeEach(async () => {
    await resetTenantTestData();
  });

  it('lists only managers in the authenticated tenant with identity and membership data', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertStaffMember({
      id: 'manager-2',
      name: 'Beta Manager',
      email: 'beta@example.com',
      role: 'manager',
      phone: null,
    });
    await insertStaffMember({
      id: 'manager-1',
      name: 'Alpha Manager',
      email: 'alpha@example.com',
      role: 'manager',
      phone: '+15551234567',
    });
    await insertStaffMember({
      id: 'courier-1',
      name: 'Courier User',
      email: 'courier@example.com',
      role: 'courier',
      phone: '+15557654321',
    });
    await insertStaffMember({
      id: 'other-tenant-manager-1',
      name: 'Other Tenant Manager',
      email: 'other@example.com',
      tenantId: 'tenant-2',
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
