import { APIError } from 'better-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'dotenv/config';
import { eq } from 'drizzle-orm';

import type { ResolvedAuthContext } from '../auth/auth-context.js';
import type { CreateStaffRequest } from '../contracts/staff.js';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required for staff-service.test.ts');
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

vi.mock('../auth/auth.js', () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
    },
  },
}));

const { auth } = await import('../auth/auth.js');
const { db } = await import('../db/index.js');
const { tenantUsers, user: authUsers } = await import('../db/schema.js');
const {
  insertTenant,
  insertTenantMembership,
  insertUser,
  resetTenantTestData,
} = await import('../test/test-db.js');
const { createStaff, deleteManager, listManagers, updateManagerProfile } =
  await import('./staff-service.js');

const signUpEmail = vi.mocked(auth.api.signUpEmail);

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

const staffRequest = {
  name: 'Staff User',
  email: 'staff@example.com',
  password: 'password123',
  role: 'manager',
} satisfies CreateStaffRequest;

const mockCreatedUser = (id = 'staff-1') => {
  signUpEmail.mockImplementation(async (input) => {
    if (!input) {
      throw new Error('signUpEmail test mock requires input.');
    }

    const { body } = input;
    const createdAt = new Date();
    const updatedAt = new Date();

    await db.insert(authUsers).values({
      id,
      name: body.name,
      email: body.email,
      emailVerified: false,
      image: null,
      createdAt,
      updatedAt,
    });

    return {
      user: {
        id,
        name: body.name,
        email: body.email,
        emailVerified: false,
        image: null,
        createdAt,
        updatedAt,
      },
      token: null,
    } as Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  });
};

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

describe('createStaff', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTenantTestData();
    mockCreatedUser();
  });

  it('allows an owner to create a manager in their tenant', async () => {
    await insertTenant();

    const result = await createStaff(ownerContext, {
      ...staffRequest,
      phone: ' +15551234567 ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        user: {
          id: 'staff-1',
          name: 'Staff User',
          email: 'staff@example.com',
        },
        membership: {
          tenantId: 'tenant-1',
          role: 'manager',
          phone: '+15551234567',
        },
      },
    });
    expect(signUpEmail).toHaveBeenCalledWith({
      body: {
        name: 'Staff User',
        email: 'staff@example.com',
        password: 'password123',
      },
    });
    await expect(getPersistedMembership()).resolves.toEqual({
      tenantId: 'tenant-1',
      userId: 'staff-1',
      role: 'manager',
      phone: '+15551234567',
    });
  });

  it('stores null phone when staff phone is omitted', async () => {
    await insertTenant();

    const result = await createStaff(ownerContext, staffRequest);

    expect(result).toEqual({
      ok: true,
      data: {
        user: {
          id: 'staff-1',
          name: 'Staff User',
          email: 'staff@example.com',
        },
        membership: {
          tenantId: 'tenant-1',
          role: 'manager',
          phone: null,
        },
      },
    });
    await expect(getPersistedMembership()).resolves.toEqual({
      tenantId: 'tenant-1',
      userId: 'staff-1',
      role: 'manager',
      phone: null,
    });
  });

  it('stores null phone when staff phone is blank', async () => {
    await insertTenant();

    const result = await createStaff(ownerContext, {
      ...staffRequest,
      phone: '   ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        user: {
          id: 'staff-1',
          name: 'Staff User',
          email: 'staff@example.com',
        },
        membership: {
          tenantId: 'tenant-1',
          role: 'manager',
          phone: null,
        },
      },
    });
    await expect(getPersistedMembership()).resolves.toEqual({
      tenantId: 'tenant-1',
      userId: 'staff-1',
      role: 'manager',
      phone: null,
    });
  });

  it('allows an owner to create a courier in their tenant', async () => {
    await insertTenant();

    const result = await createStaff(ownerContext, {
      ...staffRequest,
      role: 'courier',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        user: {
          id: 'staff-1',
          name: 'Staff User',
          email: 'staff@example.com',
        },
        membership: {
          tenantId: 'tenant-1',
          role: 'courier',
          phone: null,
        },
      },
    });
    await expect(getPersistedMembership()).resolves.toEqual({
      tenantId: 'tenant-1',
      userId: 'staff-1',
      role: 'courier',
      phone: null,
    });
  });

  it('allows a manager to create a courier in their tenant', async () => {
    await insertTenant();

    const result = await createStaff(managerContext, {
      ...staffRequest,
      role: 'courier',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        user: {
          id: 'staff-1',
          name: 'Staff User',
          email: 'staff@example.com',
        },
        membership: {
          tenantId: 'tenant-1',
          role: 'courier',
          phone: null,
        },
      },
    });
    await expect(getPersistedMembership()).resolves.toEqual({
      tenantId: 'tenant-1',
      userId: 'staff-1',
      role: 'courier',
      phone: null,
    });
  });

  it('rejects managers from creating managers', async () => {
    await insertTenant();

    const result = await createStaff(managerContext, staffRequest);

    expect(result).toEqual({
      ok: false,
      errorCode: 'FORBIDDEN',
    });
    expect(signUpEmail).not.toHaveBeenCalled();
    await expect(getPersistedAuthUser()).resolves.toBeNull();
    await expect(getPersistedMembership()).resolves.toBeNull();
  });

  it.each(['manager', 'courier'] as const)(
    'rejects couriers from creating %s users',
    async (role) => {
      await insertTenant();

      const result = await createStaff(courierContext, {
        ...staffRequest,
        role,
      });

      expect(result).toEqual({
        ok: false,
        errorCode: 'FORBIDDEN',
      });
      expect(signUpEmail).not.toHaveBeenCalled();
      await expect(getPersistedAuthUser()).resolves.toBeNull();
      await expect(getPersistedMembership()).resolves.toBeNull();
    }
  );

  it('rejects invalid staff roles', async () => {
    await insertTenant();
    const invalidRequest = {
      ...staffRequest,
      role: 'owner',
    } as unknown as CreateStaffRequest;

    const result = await createStaff(ownerContext, invalidRequest);

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_STAFF_REQUEST',
    });
    expect(signUpEmail).not.toHaveBeenCalled();
    await expect(getPersistedAuthUser()).resolves.toBeNull();
    await expect(getPersistedMembership()).resolves.toBeNull();
  });

  it('normalizes staff email before creating the auth user', async () => {
    await insertTenant();

    await createStaff(ownerContext, {
      ...staffRequest,
      email: ' Staff@Example.COM ',
    });

    expect(signUpEmail).toHaveBeenCalledWith({
      body: {
        name: 'Staff User',
        email: 'staff@example.com',
        password: 'password123',
      },
    });
  });

  it('ignores request-body tenantId and uses the resolved auth tenant', async () => {
    await insertTenant({ id: 'trusted-tenant' });
    const requestWithTenantId = {
      ...staffRequest,
      tenantId: 'attacker-tenant',
    } as CreateStaffRequest;

    const result = await createStaff(
      {
        ...ownerContext,
        tenantId: 'trusted-tenant',
      },
      requestWithTenantId
    );

    expect(result).toEqual({
      ok: true,
      data: {
        user: {
          id: 'staff-1',
          name: 'Staff User',
          email: 'staff@example.com',
        },
        membership: {
          tenantId: 'trusted-tenant',
          role: 'manager',
          phone: null,
        },
      },
    });
    await expect(getPersistedMembership()).resolves.toEqual({
      tenantId: 'trusted-tenant',
      userId: 'staff-1',
      role: 'manager',
      phone: null,
    });
  });

  it('maps duplicate staff emails to a structured error', async () => {
    await insertTenant();
    signUpEmail.mockRejectedValue(
      new APIError('UNPROCESSABLE_ENTITY', {
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        message: 'User already exists. Use another email.',
      })
    );

    const result = await createStaff(ownerContext, staffRequest);

    expect(result).toEqual({
      ok: false,
      errorCode: 'STAFF_EMAIL_ALREADY_EXISTS',
    });
    await expect(getPersistedMembership()).resolves.toBeNull();
  });

  it('cleans up the auth user when membership creation fails', async () => {
    const result = await createStaff(ownerContext, staffRequest);

    expect(result).toEqual({
      ok: false,
      errorCode: 'STAFF_CREATION_FAILED',
    });
    await expect(getPersistedAuthUser()).resolves.toBeNull();
    await expect(getPersistedMembership()).resolves.toBeNull();
  });
});

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
