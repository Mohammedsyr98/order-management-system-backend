import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'dotenv/config';

import type { ResolvedAuthContext } from '../../auth/auth-context.js';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for staff-profile-update-service.test.ts'
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
const { updateCourierProfile, updateManagerProfile, updateOwnStaffProfile } =
  await import('../staff-service.js');

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

describe('updateCourierProfile', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTenantTestData();
  });

  it('updates a courier name and phone in the authenticated tenant', async () => {
    await insertTenant();
    await insertStaffMember({
      id: 'courier-1',
      name: 'Original Courier',
      email: 'courier@example.com',
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
    await insertStaffMember({
      id: 'courier-1',
      name: 'Original Courier',
      email: 'courier@example.com',
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

  it.each([
    ['manager', 'manager-1', 'manager', 'tenant-1'],
    ['owner', 'owner-2', 'owner', 'tenant-1'],
    ['other tenant courier', 'courier-2', 'courier', 'tenant-2'],
  ] as const)(
    'rejects updates for a %s target',
    async (_label, userId, role, tenantId) => {
      await insertTenant();
      await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
      await insertStaffMember({
        id: userId,
        name: 'Target User',
        email: `${userId}@example.com`,
        tenantId,
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
    await insertStaffMember({
      id: 'manager-1',
      name: 'Original Manager',
      email: 'manager@example.com',
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
    await insertStaffMember({
      id: 'manager-1',
      name: 'Original Manager',
      email: 'manager@example.com',
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
      await insertStaffMember({
        id: userId,
        name: 'Target User',
        email: `${userId}@example.com`,
        tenantId,
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
});

describe('updateOwnStaffProfile', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTenantTestData();
  });

  it('updates the authenticated manager and returns a role-neutral staff profile', async () => {
    await insertTenant();
    await insertStaffMember({
      id: 'manager-1',
      name: 'Original Manager',
      email: 'manager@example.com',
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
    await insertStaffMember({
      id: 'courier-1',
      name: 'Original Courier',
      email: 'courier@example.com',
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

  it('rejects caller-supplied target IDs without updating either courier', async () => {
    await insertTenant();
    await insertStaffMember({
      id: 'courier-1',
      name: 'Authenticated Courier',
      email: 'courier-1@example.com',
      role: 'courier',
      phone: '+15550000001',
    });
    await insertStaffMember({
      id: 'courier-2',
      name: 'Other Courier',
      email: 'courier-2@example.com',
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
    await insertStaffMember({
      id: 'manager-1',
      name: 'Authenticated Manager',
      email: 'manager-1@example.com',
      role: 'manager',
    });
    await insertStaffMember({
      id: 'manager-2',
      name: 'Other Manager',
      email: 'manager-2@example.com',
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
