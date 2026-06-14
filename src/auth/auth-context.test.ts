import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth.js', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('../db/index.ts', () => ({
  db: {
    select: vi.fn(),
  },
}));

const { auth } = await import('./auth.js');
const { db } = await import('../db/index.js');
const { requireAuthContext, requireManagerAccess } =
  await import('./auth-context.js');

const getSession = vi.mocked(auth.api.getSession);
const select = vi.mocked(db.select);

const createProtectedApp = () => {
  const app = express();
  app.use(express.json());
  app.post('/protected', requireAuthContext, (req, res) => {
    res.json(res.locals.authContext);
  });
  return app;
};

const createManagerProtectedApp = () => {
  const app = express();
  app.use(express.json());
  app.post('/manager', requireAuthContext, requireManagerAccess, (req, res) => {
    res.json({ ok: true, role: res.locals.authContext.role });
  });
  app.post('/manager-without-context', requireManagerAccess, (req, res) => {
    res.json({ ok: true });
  });
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

describe('protected auth context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated protected requests', async () => {
    getSession.mockResolvedValue(null);

    const response = await request(createProtectedApp())
      .post('/protected')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'You must sign in to perform this action.',
      },
    });
  });

  it('rejects authenticated users without tenant membership', async () => {
    getSession.mockResolvedValue(mockSession('user-without-membership'));
    mockMembershipRows([]);

    const response = await request(createProtectedApp())
      .post('/protected')
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: 'TENANT_MEMBERSHIP_REQUIRED',
        message:
          'Your account is not linked to a tenant. Contact support for help.',
      },
    });
  });

  it('returns resolved user, tenant, and role context for tenant members', async () => {
    getSession.mockResolvedValue(mockSession('user-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'manager' }]);

    const response = await request(createProtectedApp())
      .post('/protected')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'manager',
    });
  });

  it('ignores request-body tenant IDs when resolving tenant context', async () => {
    getSession.mockResolvedValue(mockSession('user-1'));
    mockMembershipRows([{ tenantId: 'trusted-tenant', role: 'owner' }]);

    const response = await request(createProtectedApp())
      .post('/protected')
      .send({ tenantId: 'body-tenant' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userId: 'user-1',
      tenantId: 'trusted-tenant',
      role: 'owner',
    });
  });

  it('allows owners to access manager operations', async () => {
    getSession.mockResolvedValue(mockSession('owner-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'owner' }]);

    const response = await request(createManagerProtectedApp())
      .post('/manager')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, role: 'owner' });
  });

  it('allows managers to access manager operations', async () => {
    getSession.mockResolvedValue(mockSession('manager-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'manager' }]);

    const response = await request(createManagerProtectedApp())
      .post('/manager')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, role: 'manager' });
  });

  it('rejects couriers from manager operations', async () => {
    getSession.mockResolvedValue(mockSession('courier-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'courier' }]);

    const response = await request(createManagerProtectedApp())
      .post('/manager')
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      },
    });
  });

  it('rejects role checks without resolved auth context', async () => {
    const response = await request(createManagerProtectedApp())
      .post('/manager-without-context')
      .send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'You must sign in to perform this action.',
      },
    });
  });
});
