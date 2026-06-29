import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'dotenv/config';
import { eq } from 'drizzle-orm';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for staff-deletion-service.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { db } = await import('../../db/index.js');
const { tenantUsers, user: authUsers } = await import('../../db/schema.js');
const {
  insertTenant,
  insertTenantMembership,
  insertUser,
  resetTenantTestData,
} = await import('../../test/test-db.js');
const { deleteCourier, deleteManager } = await import('../staff-service.js');

const getPersistedAuthUser = async (id = 'staff-1') => {
  const [persistedUser] = await db
    .select({
      id: authUsers.id,
      name: authUsers.name,
      email: authUsers.email,
    })
    .from(authUsers)
    .where(eq(authUsers.id, id))
    .limit(1);

  return persistedUser ?? null;
};

const getPersistedMembership = async (userId = 'staff-1') => {
  const [membership] = await db
    .select({
      tenantId: tenantUsers.tenantId,
      userId: tenantUsers.userId,
      role: tenantUsers.role,
      phone: tenantUsers.phone,
    })
    .from(tenantUsers)
    .where(eq(tenantUsers.userId, userId))
    .limit(1);

  return membership ?? null;
};

describe('deleteManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTenantTestData();
  });

  it('deletes a manager auth user and cascades their tenant membership', async () => {
    await insertTenant();
    await insertUser({
      id: 'manager-1',
      name: 'Manager User',
      email: 'manager@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-manager-1',
      userId: 'manager-1',
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
      await insertUser({
        id: userId,
        name: 'Target User',
        email: `${userId}@example.com`,
      });
      await insertTenantMembership({
        id: `tenant-user-${userId}`,
        tenantId,
        userId,
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
    await insertUser({
      id: 'courier-1',
      name: 'Courier User',
      email: 'courier@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-courier-1',
      userId: 'courier-1',
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
      await insertUser({
        id: userId,
        name: 'Target User',
        email: `${userId}@example.com`,
      });
      await insertTenantMembership({
        id: `tenant-user-${userId}`,
        tenantId,
        userId,
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
