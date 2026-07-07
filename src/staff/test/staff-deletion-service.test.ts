import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'dotenv/config';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for staff-deletion-service.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { insertTenant, resetTenantTestData } =
  await import('../../test/test-db.js');
const {
  getPersistedAuthUser,
  getPersistedMembership,
  insertStaffMember,
} = await import('./test-support.js');
const { deleteCourier, deleteManager } = await import('../staff-service.js');

describe('deleteManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTenantTestData();
  });

  it('deletes a manager auth user and cascades their tenant membership', async () => {
    await insertTenant();
    await insertStaffMember({
      id: 'manager-1',
      name: 'Manager User',
      email: 'manager@example.com',
      role: 'manager',
    });

    await expect(deleteManager('tenant-1', 'manager-1')).resolves.toEqual({
      ok: true,
    });
    await expect(getPersistedAuthUser('manager-1')).resolves.toBeNull();
    await expect(getPersistedMembership('manager-1')).resolves.toBeNull();
  });

  it.each([
    ['courier', 'courier-1', 'courier', 'tenant-1'],
    ['owner', 'owner-2', 'owner', 'tenant-1'],
    ['other tenant manager', 'manager-2', 'manager', 'tenant-2'],
  ] as const)(
    'rejects deletion of a %s target',
    async (_label, userId, role, tenantId) => {
      await insertTenant();
      await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
      await insertStaffMember({
        id: userId,
        name: 'Target User',
        email: `${userId}@example.com`,
        tenantId,
        role,
      });

      await expect(deleteManager('tenant-1', userId)).resolves.toEqual({
        ok: false,
        errorCode: 'STAFF_MANAGER_NOT_FOUND',
      });
      await expect(getPersistedAuthUser(userId)).resolves.toEqual({
        id: userId,
        name: 'Target User',
        email: `${userId}@example.com`,
      });
      await expect(getPersistedMembership(userId)).resolves.toEqual({
        tenantId,
        userId,
        role,
        phone: null,
      });
    }
  );
});

describe('deleteCourier', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTenantTestData();
  });

  it('deletes a courier auth user and cascades their tenant membership', async () => {
    await insertTenant();
    await insertStaffMember({
      id: 'courier-1',
      name: 'Courier User',
      email: 'courier@example.com',
      role: 'courier',
    });

    await expect(deleteCourier('tenant-1', 'courier-1')).resolves.toEqual({
      ok: true,
    });
    await expect(getPersistedAuthUser('courier-1')).resolves.toBeNull();
    await expect(getPersistedMembership('courier-1')).resolves.toBeNull();
  });

  it.each([
    ['manager', 'manager-1', 'manager', 'tenant-1'],
    ['owner', 'owner-2', 'owner', 'tenant-1'],
    ['other tenant courier', 'courier-2', 'courier', 'tenant-2'],
  ] as const)(
    'rejects deletion of a %s target',
    async (_label, userId, role, tenantId) => {
      await insertTenant();
      await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
      await insertStaffMember({
        id: userId,
        name: 'Target User',
        email: `${userId}@example.com`,
        tenantId,
        role,
      });

      await expect(deleteCourier('tenant-1', userId)).resolves.toEqual({
        ok: false,
        errorCode: 'STAFF_COURIER_NOT_FOUND',
      });
      await expect(getPersistedAuthUser(userId)).resolves.toEqual({
        id: userId,
        name: 'Target User',
        email: `${userId}@example.com`,
      });
      await expect(getPersistedMembership(userId)).resolves.toEqual({
        tenantId,
        userId,
        role,
        phone: null,
      });
    }
  );
});
