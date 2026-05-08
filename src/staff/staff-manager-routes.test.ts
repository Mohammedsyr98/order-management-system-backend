import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type RouteAuthContext = {
  userId: string;
  tenantId: string;
  role: 'owner' | 'manager' | 'courier';
};

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for staff-manager-routes.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const routeAuth = vi.hoisted<{
  context: RouteAuthContext | null | 'missing-membership';
}>(() => ({
  context: {
    userId: 'owner-1',
    tenantId: 'tenant-1',
    role: 'owner',
  },
}));

vi.mock('../auth/auth-context.js', () => ({
  requireAuthContext: vi.fn((_req, res, next) => {
    if (routeAuth.context === null) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'You must sign in to perform this action.',
        },
      });
      return;
    }

    if (routeAuth.context === 'missing-membership') {
      res.status(403).json({
        error: {
          code: 'TENANT_MEMBERSHIP_REQUIRED',
          message:
            'Your account is not linked to a tenant. Contact support for help.',
        },
      });
      return;
    }

    res.locals.authContext = routeAuth.context;
    next();
  }),
  requireOwnerAccess: vi.fn((_req, res, next) => {
    const context = res.locals.authContext as RouteAuthContext | undefined;

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

const {
  insertTenant,
  insertTenantMembership,
  insertUser,
  resetTenantTestData,
} = await import('../test/test-db.js');
const { staffRouter } = await import('./staff-routes.js');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/staff', staffRouter);
  return app;
};

const seedManagerListingData = async () => {
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
};

describe('staff manager listing routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    routeAuth.context = {
      userId: 'owner-1',
      tenantId: 'tenant-1',
      role: 'owner',
    };
    await resetTenantTestData();
  });

  it('lists only managers in the owner tenant', async () => {
    await seedManagerListingData();

    const response = await request(createApp()).get('/api/staff/managers');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
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
