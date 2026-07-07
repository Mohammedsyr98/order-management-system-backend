import { APIError } from 'better-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'dotenv/config';
import { eq } from 'drizzle-orm';

import type { ResolvedAuthContext } from '../../auth/auth-context.js';
import type { CreateStaffRequest } from '../../contracts/staff.js';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for staff-creation-service.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

vi.mock('../../auth/auth.js', () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
    },
  },
}));

const { auth } = await import('../../auth/auth.js');
const { db } = await import('../../db/index.js');
const { tenantUsers, user: authUsers } = await import('../../db/schema.js');
const { insertTenant, resetTenantTestData } =
  await import('../../test/test-db.js');
const { createStaff } = await import('../staff-service.js');

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

  it('stores null phone when manager phone is omitted', async () => {
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

  it('stores null phone when manager phone is blank', async () => {
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
      phone: ' +15557654321 ',
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
          phone: '+15557654321',
        },
      },
    });
    await expect(getPersistedMembership()).resolves.toEqual({
      tenantId: 'tenant-1',
      userId: 'staff-1',
      role: 'courier',
      phone: '+15557654321',
    });
  });

  it('rejects courier creation without a non-empty phone', async () => {
    await insertTenant();
    const invalidPhoneInputs = [
      ['omitted', {}],
      ['null', { phone: null }],
      ['empty', { phone: '' }],
      ['whitespace-only', { phone: '   ' }],
    ] as const;

    for (const [label, phoneInput] of invalidPhoneInputs) {
      const invalidRequest = {
        ...staffRequest,
        role: 'courier',
        ...phoneInput,
      } as unknown as CreateStaffRequest;

      const result = await createStaff(ownerContext, invalidRequest);

      expect(result, `courier phone is ${label}`).toEqual({
        ok: false,
        errorCode: 'INVALID_STAFF_REQUEST',
      });
    }

    expect(signUpEmail).not.toHaveBeenCalled();
    await expect(getPersistedAuthUser()).resolves.toBeNull();
    await expect(getPersistedMembership()).resolves.toBeNull();
  });

  it('allows a manager to create a courier in their tenant', async () => {
    await insertTenant();

    const result = await createStaff(managerContext, {
      ...staffRequest,
      role: 'courier',
      phone: ' +15557654321 ',
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
          phone: '+15557654321',
        },
      },
    });
    await expect(getPersistedMembership()).resolves.toEqual({
      tenantId: 'tenant-1',
      userId: 'staff-1',
      role: 'courier',
      phone: '+15557654321',
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
        phone: '+15557654321',
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
