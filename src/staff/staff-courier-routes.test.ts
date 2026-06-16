import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type RouteAuthContext = {
  userId: string;
  tenantId: string;
  role: 'owner' | 'manager' | 'courier';
};

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for staff-courier-routes.test.ts'
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
  requireManagerAccess: vi.fn((_req, res, next) => {
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

    if (!['owner', 'manager'].includes(context.role)) {
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
  requireTenantRole: vi.fn(
    (allowedRoles: RouteAuthContext['role'][]) =>
      (_req: Request, res: Response, next: NextFunction) => {
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

        if (!allowedRoles.includes(context.role)) {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to perform this action.',
            },
          });
          return;
        }

        next();
      }
  ),
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

const seedCourierListingData = async () => {
  await insertTenant();
  await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
  await insertUser({
    id: 'courier-2',
    name: 'Beta Courier',
    email: 'beta@example.com',
  });
  await insertTenantMembership({
    id: 'tenant-user-courier-2',
    userId: 'courier-2',
    role: 'courier',
    phone: null,
  });
  await insertUser({
    id: 'courier-1',
    name: 'Alpha Courier',
    email: 'alpha@example.com',
  });
  await insertTenantMembership({
    id: 'tenant-user-courier-1',
    userId: 'courier-1',
    role: 'courier',
    phone: '+15557654321',
  });
  await insertUser({
    id: 'manager-1',
    name: 'Manager User',
    email: 'manager@example.com',
  });
  await insertTenantMembership({
    id: 'tenant-user-manager-1',
    userId: 'manager-1',
    role: 'manager',
    phone: '+15551234567',
  });
  await insertUser({
    id: 'other-tenant-courier-1',
    name: 'Other Tenant Courier',
    email: 'other@example.com',
  });
  await insertTenantMembership({
    id: 'tenant-user-other-courier-1',
    tenantId: 'tenant-2',
    userId: 'other-tenant-courier-1',
    role: 'courier',
    phone: '+15550000002',
  });
};

describe('staff courier listing routes', () => {
  beforeAll(async () => {
    vi.clearAllMocks();
    await resetTenantTestData();
    await seedCourierListingData();
  }, 30_000);

  it.each(['owner', 'manager'] as const)(
    'allows a %s to list only couriers in their tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };

      const response = await request(createApp()).get('/api/staff/couriers');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        couriers: [
          {
            id: 'courier-1',
            name: 'Alpha Courier',
            email: 'alpha@example.com',
            tenantId: 'tenant-1',
            role: 'courier',
            phone: '+15557654321',
          },
          {
            id: 'courier-2',
            name: 'Beta Courier',
            email: 'beta@example.com',
            tenantId: 'tenant-1',
            role: 'courier',
            phone: null,
          },
        ],
      });
    }
  );
});

describe('staff courier profile update routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    routeAuth.context = {
      userId: 'owner-1',
      tenantId: 'tenant-1',
      role: 'owner',
    };
    await resetTenantTestData();
    await seedCourierListingData();
  }, 30_000);

  it.each(['owner', 'manager'] as const)(
    'allows a %s to update a courier in their tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };

      const response = await request(createApp())
        .patch('/api/staff/couriers/courier-1')
        .send({
          name: ' Updated Courier ',
          phone: ' +15551112222 ',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        courier: {
          id: 'courier-1',
          name: 'Updated Courier',
          email: 'alpha@example.com',
          tenantId: 'tenant-1',
          role: 'courier',
          phone: '+15551112222',
        },
      });
    }
  );

  it('rejects attempts to clear a courier phone', async () => {
    for (const phone of [null, '', '   ']) {
      const response = await request(createApp())
        .patch('/api/staff/couriers/courier-1')
        .send({ phone });

      expect(response.status, `phone ${JSON.stringify(phone)}`).toBe(400);
      expect(response.body.error).toEqual({
        code: 'INVALID_STAFF_REQUEST',
        message: 'Staff request is invalid.',
      });
    }
  });

  it.each([
    [
      'courier',
      {
        userId: 'courier-1',
        tenantId: 'tenant-1',
        role: 'courier',
      },
      403,
      'FORBIDDEN',
      'You do not have permission to perform this action.',
    ],
    [
      'unauthenticated user',
      null,
      401,
      'UNAUTHENTICATED',
      'You must sign in to perform this action.',
    ],
    [
      'user without tenant membership',
      'missing-membership',
      403,
      'TENANT_MEMBERSHIP_REQUIRED',
      'Your account is not linked to a tenant. Contact support for help.',
    ],
  ] as const)(
    'rejects courier profile updates from a %s',
    async (_label, context, status, code, message) => {
      routeAuth.context = context;

      const response = await request(createApp())
        .patch('/api/staff/couriers/courier-1')
        .send({ name: 'Blocked Update' });

      expect(response.status).toBe(status);
      expect(response.body.error).toEqual({ code, message });
    }
  );

  it.each([
    ['manager', 'manager-1'],
    ['courier from another tenant', 'other-tenant-courier-1'],
  ] as const)(
    'returns courier not found when updating a %s',
    async (_label, courierId) => {
      const response = await request(createApp())
        .patch(`/api/staff/couriers/${courierId}`)
        .send({ name: 'Blocked Update' });

      expect(response.status).toBe(404);
      expect(response.body.error).toEqual({
        code: 'STAFF_COURIER_NOT_FOUND',
        message: 'Courier could not be found.',
      });
    }
  );
});
