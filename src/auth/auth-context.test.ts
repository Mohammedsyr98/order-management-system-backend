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
const { requireAuthContext } = await import('./auth-context.js');

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
    expect(response.body).toEqual({ error: 'UNAUTHENTICATED' });
  });

  it('rejects authenticated users without tenant membership', async () => {
    getSession.mockResolvedValue(mockSession('user-without-membership'));
    mockMembershipRows([]);

    const response = await request(createProtectedApp())
      .post('/protected')
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'TENANT_MEMBERSHIP_REQUIRED' });
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
});
