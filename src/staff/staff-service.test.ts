import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'dotenv/config';
import { eq } from 'drizzle-orm';

import type { ResolvedAuthContext } from '../auth/auth-context.js';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required for staff-service.test.ts');
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { db } = await import('../db/index.js');
const { tenantUsers, user: authUsers } = await import('../db/schema.js');
const {
  insertTenant,
  insertTenantMembership,
  insertUser,
  resetTenantTestData,
} = await import('../test/test-db.js');
const {
  deleteCourier,
  deleteManager,
  listCouriers,
  listManagers,
  updateCourierProfile,
  updateManagerProfile,
  updateOwnStaffProfile,
} = await import('./staff-service.js');

const ownerContext = {
  userId: 'owner-1',
  tenantId: 'tenant-1',
  role: 'owner',
} satisfies ResolvedAuthContext;

const managerContext = {
  userId: 'manager-1',
  tenantId: 'tenant-1',
  role: 'manager',
} satisfies ResolvedAuthContext;

const courierContext = {
  userId: 'courier-1',
  tenantId: 'tenant-1',
  role: 'courier',
} satisfies ResolvedAuthContext;

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

describe('listManagers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
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

describe('listCouriers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
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

describe('updateCourierProfile', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTenantTestData();
  });

  it('updates a courier name and phone in the authenticated tenant', async () => {
    await insertTenant();
    await insertUser({
      id: 'courier-1',
      name: 'Original Courier',
      email: 'courier@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-courier-1',
      userId: 'courier-1',
      role: 'courier',
      phone: '+15550000000',
    });

    const result = await updateCourierProfile('tenant-1', 'courier-1', {
      name: ' Updated Courier ',
      phone: ' +15557654321 ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        courier: {
          id: 'courier-1',
          name: 'Updated Courier',
          email: 'courier@example.com',
          tenantId: 'tenant-1',
          role: 'courier',
          phone: '+15557654321',
        },
      },
    });
    await expect(getPersistedAuthUser('courier-1')).resolves.toEqual({
      id: 'courier-1',
      name: 'Updated Courier',
      email: 'courier@example.com',
    });
    await expect(getPersistedMembership('courier-1')).resolves.toEqual({
      tenantId: 'tenant-1',
      userId: 'courier-1',
      role: 'courier',
      phone: '+15557654321',
    });
  });

  it('leaves an omitted courier name unchanged when replacing the phone', async () => {
    await insertTenant();
    await insertUser({
      id: 'courier-1',
      name: 'Original Courier',
      email: 'courier@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-courier-1',
      userId: 'courier-1',
      role: 'courier',
      phone: '+15550000000',
    });

    const result = await updateCourierProfile('tenant-1', 'courier-1', {
      phone: ' +15557654321 ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        courier: {
          id: 'courier-1',
          name: 'Original Courier',
          email: 'courier@example.com',
          tenantId: 'tenant-1',
          role: 'courier',
          phone: '+15557654321',
        },
      },
    });
  });

  it('rejects invalid courier profile updates', async () => {
    await insertTenant();
    const invalidUpdates = [
      ['empty body', {}],
      ['null phone', { phone: null }],
      ['empty phone', { phone: '' }],
      ['whitespace-only phone', { phone: '   ' }],
      ['blank name', { name: '   ' }],
      ['email', { email: 'new@example.com' }],
      ['password', { password: 'new-password' }],
      ['role', { role: 'manager' }],
      ['tenantId', { tenantId: 'tenant-2' }],
      ['userId', { userId: 'courier-2' }],
      ['courierId', { courierId: 'courier-2' }],
    ] as const;

    for (const [label, update] of invalidUpdates) {
      const result = await updateCourierProfile(
        'tenant-1',
        'courier-1',
        update as unknown as Parameters<typeof updateCourierProfile>[2]
      );

      expect(result, label).toEqual({
        ok: false,
        errorCode: 'INVALID_STAFF_REQUEST',
      });
    }
  });

  it.each([
    ['manager', 'manager-1', 'manager', 'tenant-1'],
    ['owner', 'owner-2', 'owner', 'tenant-1'],
    ['other tenant courier', 'courier-2', 'courier', 'tenant-2'],
  ] as const)(
    'rejects updates for a %s target',
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
        phone: '+15550000000',
      });

      const result = await updateCourierProfile('tenant-1', userId, {
        name: 'Blocked Update',
      });

      expect(result).toEqual({
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
        phone: '+15550000000',
      });
    }
  );
});

describe('updateManagerProfile', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTenantTestData();
  });

  it('updates a manager name and phone in the authenticated tenant', async () => {
    await insertTenant();
    await insertUser({
      id: 'manager-1',
      name: 'Original Manager',
      email: 'manager@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-manager-1',
      userId: 'manager-1',
      role: 'manager',
      phone: '+15550000000',
    });

    const result = await updateManagerProfile('tenant-1', 'manager-1', {
      name: ' Updated Manager ',
      phone: ' +15551234567 ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        manager: {
          id: 'manager-1',
          name: 'Updated Manager',
          email: 'manager@example.com',
          tenantId: 'tenant-1',
          role: 'manager',
          phone: '+15551234567',
        },
      },
    });
    await expect(getPersistedAuthUser('manager-1')).resolves.toEqual({
      id: 'manager-1',
      name: 'Updated Manager',
      email: 'manager@example.com',
    });
    await expect(getPersistedMembership('manager-1')).resolves.toEqual({
      tenantId: 'tenant-1',
      userId: 'manager-1',
      role: 'manager',
      phone: '+15551234567',
    });
  });

  it('leaves omitted manager profile fields unchanged', async () => {
    await insertTenant();
    await insertUser({
      id: 'manager-1',
      name: 'Original Manager',
      email: 'manager@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-manager-1',
      userId: 'manager-1',
      role: 'manager',
      phone: '+15550000000',
    });

    const result = await updateManagerProfile('tenant-1', 'manager-1', {
      phone: null,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        manager: {
          id: 'manager-1',
          name: 'Original Manager',
          email: 'manager@example.com',
          tenantId: 'tenant-1',
          role: 'manager',
          phone: null,
        },
      },
    });
    await expect(getPersistedAuthUser('manager-1')).resolves.toEqual({
      id: 'manager-1',
      name: 'Original Manager',
      email: 'manager@example.com',
    });
  });

  it.each([
    ['courier', 'courier-1', 'courier', 'tenant-1'],
    ['owner', 'owner-2', 'owner', 'tenant-1'],
    ['other tenant manager', 'manager-2', 'manager', 'tenant-2'],
  ] as const)(
    'rejects updates for a %s target',
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
        phone: '+15550000000',
      });

      const result = await updateManagerProfile('tenant-1', userId, {
        name: 'Blocked Update',
      });

      expect(result).toEqual({
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
        phone: '+15550000000',
      });
    }
  );

  it('rejects protected manager profile fields', async () => {
    await insertTenant();

    const result = await updateManagerProfile('tenant-1', 'manager-1', {
      name: 'Updated Manager',
      role: 'courier',
    } as unknown as Parameters<typeof updateManagerProfile>[2]);

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_STAFF_REQUEST',
    });
  });
});

describe('updateOwnStaffProfile', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTenantTestData();
  });

  it('updates the authenticated manager and returns a role-neutral staff profile', async () => {
    await insertTenant();
    await insertUser({
      id: 'manager-1',
      name: 'Original Manager',
      email: 'manager@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-manager-1',
      userId: 'manager-1',
      role: 'manager',
      phone: '+15550000000',
    });

    const result = await updateOwnStaffProfile(managerContext, {
      name: ' Updated Manager ',
      phone: ' +15551234567 ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        staff: {
          id: 'manager-1',
          name: 'Updated Manager',
          email: 'manager@example.com',
          tenantId: 'tenant-1',
          role: 'manager',
          phone: '+15551234567',
        },
      },
    });
  });

  it('updates the authenticated courier and returns a role-neutral staff profile', async () => {
    await insertTenant();
    await insertUser({
      id: 'courier-1',
      name: 'Original Courier',
      email: 'courier@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-courier-1',
      userId: 'courier-1',
      role: 'courier',
      phone: '+15550000000',
    });

    const result = await updateOwnStaffProfile(courierContext, {
      name: ' Updated Courier ',
      phone: ' +15557654321 ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        staff: {
          id: 'courier-1',
          name: 'Updated Courier',
          email: 'courier@example.com',
          tenantId: 'tenant-1',
          role: 'courier',
          phone: '+15557654321',
        },
      },
    });
    await expect(getPersistedAuthUser('courier-1')).resolves.toEqual({
      id: 'courier-1',
      name: 'Updated Courier',
      email: 'courier@example.com',
    });
    await expect(getPersistedMembership('courier-1')).resolves.toEqual({
      tenantId: 'tenant-1',
      userId: 'courier-1',
      role: 'courier',
      phone: '+15557654321',
    });
  });

  it('rejects courier self-profile phone clearing', async () => {
    await insertTenant();
    await insertUser({
      id: 'courier-1',
      name: 'Original Courier',
      email: 'courier@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-courier-1',
      userId: 'courier-1',
      role: 'courier',
      phone: '+15550000000',
    });

    const invalidPhoneInputs = [
      ['null', null],
      ['empty', ''],
      ['whitespace-only', '   '],
    ] as const;

    for (const [label, phone] of invalidPhoneInputs) {
      const result = await updateOwnStaffProfile(courierContext, {
        phone,
      } as unknown as Parameters<typeof updateOwnStaffProfile>[1]);

      expect(result, `courier phone is ${label}`).toEqual({
        ok: false,
        errorCode: 'INVALID_STAFF_REQUEST',
      });
    }

    await expect(getPersistedMembership('courier-1')).resolves.toEqual({
      tenantId: 'tenant-1',
      userId: 'courier-1',
      role: 'courier',
      phone: '+15550000000',
    });
  });

  it('rejects caller-supplied target IDs without updating either courier', async () => {
    await insertTenant();
    await insertUser({
      id: 'courier-1',
      name: 'Authenticated Courier',
      email: 'courier-1@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-courier-1',
      userId: 'courier-1',
      role: 'courier',
      phone: '+15550000001',
    });
    await insertUser({
      id: 'courier-2',
      name: 'Other Courier',
      email: 'courier-2@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-courier-2',
      userId: 'courier-2',
      role: 'courier',
      phone: '+15550000002',
    });

    const result = await updateOwnStaffProfile(courierContext, {
      name: 'Redirected Update',
      courierId: 'courier-2',
    } as unknown as Parameters<typeof updateOwnStaffProfile>[1]);

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_STAFF_REQUEST',
    });
    await expect(getPersistedAuthUser('courier-1')).resolves.toEqual({
      id: 'courier-1',
      name: 'Authenticated Courier',
      email: 'courier-1@example.com',
    });
    await expect(getPersistedAuthUser('courier-2')).resolves.toEqual({
      id: 'courier-2',
      name: 'Other Courier',
      email: 'courier-2@example.com',
    });
  });

  it('rejects caller-supplied target IDs without updating either manager', async () => {
    await insertTenant();
    await insertUser({
      id: 'manager-1',
      name: 'Authenticated Manager',
      email: 'manager-1@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-manager-1',
      userId: 'manager-1',
      role: 'manager',
    });
    await insertUser({
      id: 'manager-2',
      name: 'Other Manager',
      email: 'manager-2@example.com',
    });
    await insertTenantMembership({
      id: 'tenant-user-manager-2',
      userId: 'manager-2',
      role: 'manager',
    });

    const result = await updateOwnStaffProfile(managerContext, {
      name: 'Redirected Update',
      managerId: 'manager-2',
    } as unknown as Parameters<typeof updateOwnStaffProfile>[1]);

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_STAFF_REQUEST',
    });
    await expect(getPersistedAuthUser('manager-1')).resolves.toEqual({
      id: 'manager-1',
      name: 'Authenticated Manager',
      email: 'manager-1@example.com',
    });
    await expect(getPersistedAuthUser('manager-2')).resolves.toEqual({
      id: 'manager-2',
      name: 'Other Manager',
      email: 'manager-2@example.com',
    });
  });
});

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
