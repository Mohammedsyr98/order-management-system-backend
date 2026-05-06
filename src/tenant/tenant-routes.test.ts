import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/auth.js', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('../db/index.ts', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

const { auth } = await import('../auth/auth.js');
const { db } = await import('../db/index.js');
const { tenantRouter } = await import('./tenant-routes.js');

const getSession = vi.mocked(auth.api.getSession);
const select = vi.mocked(db.select);
const update = vi.mocked(db.update);

const defaultOperatingHours = {
  monday: { status: 'open', open: '09:00', close: '17:00' },
  tuesday: { status: 'open', open: '09:00', close: '17:00' },
  wednesday: { status: 'open', open: '09:00', close: '17:00' },
  thursday: { status: 'open', open: '09:00', close: '17:00' },
  friday: { status: 'open', open: '09:00', close: '17:00' },
  saturday: { status: 'open', open: '09:00', close: '17:00' },
  sunday: { status: 'closed' },
};

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/tenant', tenantRouter);
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

  select.mockReturnValueOnce({
    from,
  } as unknown as ReturnType<typeof db.select>);
};

const mockTenantUpdate = (
  rows = [
    {
      id: 'tenant-1',
      name: 'Updated Tenant',
      phone: '+15551234567',
      timezone: 'Europe/Istanbul',
      operatingHours: defaultOperatingHours,
    },
  ]
) => {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });

  update.mockReturnValue({ set } as unknown as ReturnType<typeof db.update>);
};

const mockTenantProfileRows = (
  rows = [
    {
      id: 'tenant-1',
      name: 'Main Tenant',
      phone: '+15550000000',
      timezone: 'Europe/Istanbul',
      operatingHours: defaultOperatingHours,
    },
  ]
) => {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });

  select.mockReturnValueOnce({
    from,
  } as unknown as ReturnType<typeof db.select>);
};

describe('tenant routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantUpdate();
  });

  it('allows an owner to update their tenant profile', async () => {
    getSession.mockResolvedValue(mockSession('owner-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'owner' }]);
    mockTenantUpdate([
      {
        id: 'tenant-1',
        name: 'Existing Tenant',
        phone: '+15551234567',
        timezone: 'Europe/Istanbul',
        operatingHours: defaultOperatingHours,
      },
    ]);

    const response = await request(createApp()).patch('/api/tenant').send({
      phone: ' +15551234567 ',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      tenant: {
        id: 'tenant-1',
        name: 'Existing Tenant',
        phone: '+15551234567',
        timezone: 'Europe/Istanbul',
        operatingHours: defaultOperatingHours,
      },
    });
  });

  it('returns the current tenant profile for a tenant member', async () => {
    getSession.mockResolvedValue(mockSession('manager-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'manager' }]);
    mockTenantProfileRows();

    const response = await request(createApp()).get('/api/tenant');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      tenant: {
        id: 'tenant-1',
        name: 'Main Tenant',
        phone: '+15550000000',
        timezone: 'Europe/Istanbul',
        operatingHours: defaultOperatingHours,
      },
    });
  });

  it('returns not found when the current tenant profile does not exist', async () => {
    getSession.mockResolvedValue(mockSession('manager-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'manager' }]);
    mockTenantProfileRows([]);

    const response = await request(createApp()).get('/api/tenant');

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'TENANT_PROFILE_NOT_FOUND',
      message: 'Tenant profile could not be found.',
    });
  });

  it('rejects tenant updates from non-owner members', async () => {
    getSession.mockResolvedValue(mockSession('manager-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'manager' }]);

    const response = await request(createApp()).patch('/api/tenant').send({
      name: 'Updated Tenant',
      phone: '+15551234567',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects tenant updates with no profile fields', async () => {
    getSession.mockResolvedValue(mockSession('owner-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'owner' }]);

    const response = await request(createApp()).patch('/api/tenant').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'INVALID_TENANT_PROFILE',
      message: 'Tenant profile update is invalid.',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects tenant updates with blank provided profile fields', async () => {
    getSession.mockResolvedValue(mockSession('owner-1'));
    mockMembershipRows([{ tenantId: 'tenant-1', role: 'owner' }]);

    const response = await request(createApp()).patch('/api/tenant').send({
      phone: '',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_TENANT_PROFILE');
    expect(update).not.toHaveBeenCalled();
  });
});
