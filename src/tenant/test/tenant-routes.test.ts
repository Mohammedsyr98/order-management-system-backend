import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  defaultOperatingHours,
  defaultTenantTimezone,
} from '../../contracts/tenant.js';

const routeAuth = vi.hoisted(() => ({
  context: {
    userId: 'owner-1',
    tenantId: 'tenant-1',
    role: 'owner',
  },
}));

vi.mock('../../auth/auth-context.js', () => ({
  requireAuthContext: vi.fn((_req, res, next) => {
    if (!routeAuth.context) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'You must sign in to perform this action.',
        },
      });
      return;
    }

    res.locals.authContext = routeAuth.context;
    next();
  }),
  requireOwnerAccess: vi.fn((_req, res, next) => {
    const context = res.locals.authContext;

    if (!context) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'You must sign in to perform this action.',
        },
      });
      return;
    }

    if (context.role !== 'owner') {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
        },
      });
      return;
    }

    next();
  }),
}));

vi.mock('../tenant-service.js', () => ({
  getTenantProfile: vi.fn(),
  updateTenantProfile: vi.fn(),
}));

const { getTenantProfile, updateTenantProfile } =
  await import('../tenant-service.js');
const { tenantRouter } = await import('../tenant-routes.js');

const getTenantProfileMock = vi.mocked(getTenantProfile);
const updateTenantProfileMock = vi.mocked(updateTenantProfile);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/tenant', tenantRouter);
  return app;
};

const tenant = {
  id: 'tenant-1',
  name: 'Main Tenant',
  phone: '+15550000000',
  timezone: defaultTenantTimezone,
  operatingHours: defaultOperatingHours,
};

describe('tenant routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeAuth.context = {
      userId: 'owner-1',
      tenantId: 'tenant-1',
      role: 'owner',
    };
  });

  it('returns the current tenant profile for a tenant member', async () => {
    getTenantProfileMock.mockResolvedValue({
      ok: true,
      data: { tenant },
    });

    const response = await request(createApp()).get('/api/tenant');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ tenant });
    expect(getTenantProfileMock).toHaveBeenCalledWith('tenant-1');
  });

  it('returns not found when the current tenant profile does not exist', async () => {
    getTenantProfileMock.mockResolvedValue({
      ok: false,
      errorCode: 'TENANT_PROFILE_NOT_FOUND',
    });

    const response = await request(createApp()).get('/api/tenant');

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({
      code: 'TENANT_PROFILE_NOT_FOUND',
      message: 'Tenant profile could not be found.',
    });
  });

  it('allows an owner to update their tenant profile', async () => {
    updateTenantProfileMock.mockResolvedValue({
      ok: true,
      data: {
        tenant: {
          ...tenant,
          phone: '+15551234567',
        },
      },
    });

    const response = await request(createApp()).patch('/api/tenant').send({
      phone: ' +15551234567 ',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      tenant: {
        ...tenant,
        phone: '+15551234567',
      },
    });
    expect(updateTenantProfileMock).toHaveBeenCalledWith('tenant-1', {
      phone: ' +15551234567 ',
    });
  });

  it('rejects tenant updates from non-owner members', async () => {
    routeAuth.context = {
      userId: 'manager-1',
      tenantId: 'tenant-1',
      role: 'manager',
    };

    const response = await request(createApp()).patch('/api/tenant').send({
      name: 'Updated Tenant',
      phone: '+15551234567',
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });
    expect(updateTenantProfileMock).not.toHaveBeenCalled();
  });

  it('maps invalid tenant profile updates to bad requests', async () => {
    updateTenantProfileMock.mockResolvedValue({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });

    const response = await request(createApp()).patch('/api/tenant').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'INVALID_TENANT_PROFILE',
      message: 'Tenant profile update is invalid.',
    });
  });

  it('maps failed tenant profile updates to unprocessable entity responses', async () => {
    updateTenantProfileMock.mockResolvedValue({
      ok: false,
      errorCode: 'TENANT_UPDATE_FAILED',
    });

    const response = await request(createApp()).patch('/api/tenant').send({
      name: 'Updated Tenant',
    });

    expect(response.status).toBe(422);
    expect(response.body.error).toEqual({
      code: 'TENANT_UPDATE_FAILED',
      message: 'Tenant profile could not be updated.',
    });
  });
});
