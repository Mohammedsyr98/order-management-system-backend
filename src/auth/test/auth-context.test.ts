import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppSessionResolution } from '../../session/session-types.js';

vi.mock('../../session/session-service.js', () => ({
  resolveSession: vi.fn(),
}));

const { resolveSession } = await import('../../session/session-service.js');
const { requireAuthContext, requireManagerAccess } =
  await import('../auth-context.js');

const mockedResolveSession = vi.mocked(resolveSession);

const resolvedSession = (
  overrides: Partial<{
    userId: string;
    tenantId: string;
    role: 'owner' | 'manager' | 'courier';
  }> = {}
) =>
  ({
    user: {
      id: overrides.userId ?? 'user-1',
      name: 'Owner User',
      email: 'owner@example.com',
    },
    context: {
      tenantId: overrides.tenantId ?? 'tenant-1',
      tenantName: 'Main Tenant',
      role: overrides.role ?? 'manager',
    },
  }) satisfies Exclude<AppSessionResolution, null | 'missing-membership'>;

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

describe('protected auth context', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects unauthenticated protected requests', async () => {
    mockedResolveSession.mockResolvedValue(null);

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
    mockedResolveSession.mockResolvedValue('missing-membership');

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
    mockedResolveSession.mockResolvedValue(
      resolvedSession({
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'manager',
      })
    );

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
    mockedResolveSession.mockResolvedValue(
      resolvedSession({ tenantId: 'trusted-tenant', role: 'owner' })
    );

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
    mockedResolveSession.mockResolvedValue(
      resolvedSession({ userId: 'owner-1', role: 'owner' })
    );

    const response = await request(createManagerProtectedApp())
      .post('/manager')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, role: 'owner' });
  });

  it('allows managers to access manager operations', async () => {
    mockedResolveSession.mockResolvedValue(
      resolvedSession({ userId: 'manager-1', role: 'manager' })
    );

    const response = await request(createManagerProtectedApp())
      .post('/manager')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, role: 'manager' });
  });

  it('rejects couriers from manager operations', async () => {
    mockedResolveSession.mockResolvedValue(
      resolvedSession({ userId: 'courier-1', role: 'courier' })
    );

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
