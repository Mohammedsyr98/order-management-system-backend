import express from 'express';
import { APIError } from 'better-auth';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/auth.js', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      signUpEmail: vi.fn(),
    },
  },
}));

vi.mock('../db/index.ts', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

const { auth } = await import('../auth/auth.js');
const { db } = await import('../db/index.js');
const { staffRouter } = await import('./staff-routes.js');

const getSession = vi.mocked(auth.api.getSession);
const signUpEmail = vi.mocked(auth.api.signUpEmail);
const select = vi.mocked(db.select);
const insert = vi.mocked(db.insert);
const deleteFrom = vi.mocked(db.delete);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/staff', staffRouter);
  return app;
};

const mockSession = (userId: string) =>
  ({
    user: { id: userId },
    session: { userId },
  }) as Awaited<ReturnType<typeof auth.api.getSession>>;

const mockMembershipRows = (
  rows: Array<{ tenantId: string; role: 'owner' | 'manager' | 'courier' }>
) => {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });

  select.mockReturnValue({ from } as unknown as ReturnType<typeof db.select>);
};

const mockMembershipInsert = (
  rows?: Array<{ tenantId: string; role: 'manager' | 'courier' }>
) => {
  let insertedValues:
    | { tenantId: string; role: 'manager' | 'courier' }
    | undefined;
  const returning = vi.fn().mockImplementation(() =>
    Promise.resolve(
      rows ?? [
        {
          tenantId: insertedValues?.tenantId ?? 'tenant-1',
          role: insertedValues?.role ?? 'manager',
        },
      ]
    )
  );
  const values = vi.fn().mockImplementation((values) => {
    insertedValues = values;

    return { returning };
  });

  insert.mockReturnValue({ values } as unknown as ReturnType<typeof db.insert>);

  return { values };
};

const mockCreatedUser = (id = 'staff-1') => {
  signUpEmail.mockResolvedValue({
    user: {
      id,
      name: 'Staff User',
      email: 'staff@example.com',
      emailVerified: false,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    token: null,
  } as Awaited<ReturnType<typeof auth.api.signUpEmail>>);
};

describe('staff routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatedUser();
    mockMembershipInsert();
  });

  it('rejects unauthenticated staff creation requests', async () => {
    getSession.mockResolvedValue(null);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'manager',
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'You must sign in to perform this action.',
    });
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects staff creation for authenticated users without tenant membership', async () => {
    getSession.mockResolvedValue(mockSession('tenantless-user'));
    mockMembershipRows([]);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'manager',
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'TENANT_MEMBERSHIP_REQUIRED',
      message:
        'Your account is not linked to a tenant. Contact support for help.',
    });
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('allows an owner to create a manager in their tenant', async () => {
    getSession.mockResolvedValue(mockSession('owner-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'owner' }]);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'manager',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user: {
        id: 'staff-1',
        name: 'Staff User',
        email: 'staff@example.com',
      },
      membership: {
        tenantId: 'tenant-1',
        role: 'manager',
      },
    });
    expect(signUpEmail).toHaveBeenCalledWith({
      body: {
        name: 'Staff User',
        email: 'staff@example.com',
        password: 'password123',
      },
    });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('normalizes staff email before creating the auth user', async () => {
    getSession.mockResolvedValue(mockSession('owner-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'owner' }]);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: ' Staff@Example.COM ',
      password: 'password123',
      role: 'manager',
    });

    expect(response.status).toBe(201);
    expect(signUpEmail).toHaveBeenCalledWith({
      body: {
        name: 'Staff User',
        email: 'staff@example.com',
        password: 'password123',
      },
    });
  });

  it('allows an owner to create a courier in their tenant', async () => {
    getSession.mockResolvedValue(mockSession('owner-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'owner' }]);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'courier',
    });

    expect(response.status).toBe(201);
    expect(response.body.membership).toEqual({
      tenantId: 'tenant-1',
      role: 'courier',
    });
  });

  it('allows a manager to create a courier in their tenant', async () => {
    getSession.mockResolvedValue(mockSession('manager-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'manager' }]);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'courier',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user: {
        id: 'staff-1',
        name: 'Staff User',
        email: 'staff@example.com',
      },
      membership: {
        tenantId: 'tenant-1',
        role: 'courier',
      },
    });
  });

  it('ignores request-body tenantId and uses the owner tenant', async () => {
    getSession.mockResolvedValue(mockSession('owner-1'));
    mockMembershipRows([{ tenantId: 'trusted-tenant', role: 'owner' }]);
    const { values } = mockMembershipInsert([
      { tenantId: 'trusted-tenant', role: 'manager' },
    ]);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'manager',
      tenantId: 'attacker-tenant',
    });

    expect(response.status).toBe(201);
    expect(response.body.membership.tenantId).toBe('trusted-tenant');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'trusted-tenant',
        userId: 'staff-1',
        role: 'manager',
      })
    );
    expect(values).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'attacker-tenant' })
    );
  });

  it('ignores request-body tenantId and uses the manager tenant', async () => {
    getSession.mockResolvedValue(mockSession('manager-1'));
    mockMembershipRows([{ tenantId: 'trusted-tenant', role: 'manager' }]);
    const { values } = mockMembershipInsert([
      { tenantId: 'trusted-tenant', role: 'courier' },
    ]);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'courier',
      tenantId: 'attacker-tenant',
    });

    expect(response.status).toBe(201);
    expect(response.body.membership.tenantId).toBe('trusted-tenant');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'trusted-tenant',
        userId: 'staff-1',
        role: 'courier',
      })
    );
    expect(values).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'attacker-tenant' })
    );
  });

  it('rejects managers from creating managers', async () => {
    getSession.mockResolvedValue(mockSession('manager-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'manager' }]);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'manager',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('rejects managers from creating owners as an invalid staff role', async () => {
    getSession.mockResolvedValue(mockSession('manager-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'manager' }]);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'owner',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_STAFF_ROLE');
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('rejects couriers from creating users', async () => {
    getSession.mockResolvedValue(mockSession('courier-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'courier' }]);

    const managerResponse = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'manager',
    });

    getSession.mockResolvedValue(mockSession('courier-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'courier' }]);

    const courierResponse = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'courier',
    });

    expect(managerResponse.status).toBe(403);
    expect(managerResponse.body.error.code).toBe('FORBIDDEN');
    expect(courierResponse.status).toBe(403);
    expect(courierResponse.body.error.code).toBe('FORBIDDEN');
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('rejects invalid staff roles', async () => {
    getSession.mockResolvedValue(mockSession('owner-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'owner' }]);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'owner',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'INVALID_STAFF_ROLE',
      message: 'Staff role must be manager or courier.',
    });
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('maps duplicate staff emails to a structured error', async () => {
    getSession.mockResolvedValue(mockSession('owner-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'owner' }]);
    signUpEmail.mockRejectedValue(
      new APIError('UNPROCESSABLE_ENTITY', {
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        message: 'User already exists. Use another email.',
      })
    );

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'manager',
    });

    expect(response.status).toBe(422);
    expect(response.body.error).toEqual({
      code: 'STAFF_EMAIL_ALREADY_EXISTS',
      message: 'A user with this email already exists.',
    });
  });

  it('cleans up the auth user when membership creation fails', async () => {
    getSession.mockResolvedValue(mockSession('owner-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'owner' }]);
    mockMembershipInsert([]);
    const where = vi.fn().mockResolvedValue(undefined);
    deleteFrom.mockReturnValue({ where } as unknown as ReturnType<
      typeof db.delete
    >);

    const response = await request(createApp()).post('/api/staff').send({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'password123',
      role: 'manager',
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('STAFF_CREATION_FAILED');
    expect(deleteFrom).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });
});
