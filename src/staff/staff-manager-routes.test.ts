import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
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

const seedManagerProfileData = async () => {
  await insertTenant();
  await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
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
    id: 'owner-target-1',
    name: 'Owner Target',
    email: 'owner-target@example.com',
  });
  await insertTenantMembership({
    id: 'tenant-user-owner-target-1',
    userId: 'owner-target-1',
    role: 'owner',
    phone: '+15550000001',
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

describe('staff manager routes', () => {
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

  describe('staff manager profile update routes', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      routeAuth.context = {
        userId: 'owner-1',
        tenantId: 'tenant-1',
        role: 'owner',
      };
      await resetTenantTestData();
    });

    it('allows an owner to update a manager name and phone in their tenant', async () => {
      await seedManagerProfileData();

      const response = await request(createApp())
        .patch('/api/staff/managers/manager-1')
        .send({
          name: ' Updated Manager ',
          phone: ' +15551234567 ',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        manager: {
          id: 'manager-1',
          name: 'Updated Manager',
          email: 'manager@example.com',
          tenantId: 'tenant-1',
          role: 'manager',
          phone: '+15551234567',
        },
      });
    });

    it('allows an owner to update only a manager name', async () => {
      await seedManagerProfileData();

      const response = await request(createApp())
        .patch('/api/staff/managers/manager-1')
        .send({
          name: 'Renamed Manager',
        });

      expect(response.status).toBe(200);
      expect(response.body.manager).toEqual({
        id: 'manager-1',
        name: 'Renamed Manager',
        email: 'manager@example.com',
        tenantId: 'tenant-1',
        role: 'manager',
        phone: '+15550000000',
      });
    });

    it('allows an owner to update only a manager phone', async () => {
      await seedManagerProfileData();

      const response = await request(createApp())
        .patch('/api/staff/managers/manager-1')
        .send({
          phone: '+15551230000',
        });

      expect(response.status).toBe(200);
      expect(response.body.manager).toEqual({
        id: 'manager-1',
        name: 'Original Manager',
        email: 'manager@example.com',
        tenantId: 'tenant-1',
        role: 'manager',
        phone: '+15551230000',
      });
    });

    it.each([
      ['null', null],
      ['blank string', '   '],
    ] as const)(
      'allows an owner to clear manager phone with %s',
      async (_label, phone) => {
        await seedManagerProfileData();

        const response = await request(createApp())
          .patch('/api/staff/managers/manager-1')
          .send({ phone });

        expect(response.status).toBe(200);
        expect(response.body.manager.phone).toBeNull();
      }
    );

    it.each([
      ['empty body', {}],
      ['blank name', { name: '   ' }],
      ['email', { email: 'new@example.com' }],
      ['password', { password: 'new-password' }],
      ['role', { role: 'courier' }],
      ['tenantId', { tenantId: 'tenant-2' }],
    ] as const)(
      'rejects invalid manager profile update body with %s',
      async (_label, body) => {
        await seedManagerProfileData();

        const response = await request(createApp())
          .patch('/api/staff/managers/manager-1')
          .send(body);

        expect(response.status).toBe(400);
        expect(response.body.error).toEqual({
          code: 'INVALID_STAFF_REQUEST',
          message: 'Staff request is invalid.',
        });
      }
    );

    it.each(['manager', 'courier'] as const)(
      'rejects manager profile updates from %s users',
      async (role) => {
        await seedManagerProfileData();
        routeAuth.context = {
          userId: `${role}-1`,
          tenantId: 'tenant-1',
          role,
        };

        const response = await request(createApp())
          .patch('/api/staff/managers/manager-1')
          .send({
            name: 'Blocked Update',
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
        });
      }
    );

    it('rejects unauthenticated manager profile update requests', async () => {
      await seedManagerProfileData();
      routeAuth.context = null;

      const response = await request(createApp())
        .patch('/api/staff/managers/manager-1')
        .send({
          name: 'Blocked Update',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toEqual({
        code: 'UNAUTHENTICATED',
        message: 'You must sign in to perform this action.',
      });
    });

    it('rejects manager profile updates for authenticated users without tenant membership', async () => {
      await seedManagerProfileData();
      routeAuth.context = 'missing-membership';

      const response = await request(createApp())
        .patch('/api/staff/managers/manager-1')
        .send({
          name: 'Blocked Update',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toEqual({
        code: 'TENANT_MEMBERSHIP_REQUIRED',
        message:
          'Your account is not linked to a tenant. Contact support for help.',
      });
    });

    it.each([
      ['courier', 'courier-1'],
      ['owner', 'owner-target-1'],
      ['other tenant manager', 'other-tenant-manager-1'],
    ] as const)(
      'returns not found when updating a %s',
      async (_label, managerId) => {
        await seedManagerProfileData();

        const response = await request(createApp())
          .patch(`/api/staff/managers/${managerId}`)
          .send({
            name: 'Blocked Update',
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toEqual({
          code: 'STAFF_MANAGER_NOT_FOUND',
          message: 'Manager could not be found.',
        });
      }
    );
  });

  describe('staff self-profile update routes', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      routeAuth.context = {
        userId: 'manager-1',
        tenantId: 'tenant-1',
        role: 'manager',
      };
      await resetTenantTestData();
    });

    it('allows a manager to update their own name and phone', async () => {
      await seedManagerProfileData();

      const response = await request(createApp()).patch('/api/staff/me').send({
        name: ' Updated Manager ',
        phone: ' +15551234567 ',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        staff: {
          id: 'manager-1',
          name: 'Updated Manager',
          email: 'manager@example.com',
          tenantId: 'tenant-1',
          role: 'manager',
          phone: '+15551234567',
        },
      });
    });

    it.each([
      ['null', null],
      ['blank string', '   '],
    ] as const)(
      'allows a manager to clear their own phone with %s',
      async (_label, phone) => {
        await seedManagerProfileData();

        const response = await request(createApp())
          .patch('/api/staff/me')
          .send({ phone });

        expect(response.status).toBe(200);
        expect(response.body.staff).toEqual({
          id: 'manager-1',
          name: 'Original Manager',
          email: 'manager@example.com',
          tenantId: 'tenant-1',
          role: 'manager',
          phone: null,
        });
      }
    );

    it.each([
      ['empty body', {}],
      ['blank name', { name: '   ' }],
      ['email', { email: 'new@example.com' }],
      ['password', { password: 'new-password' }],
      ['role', { role: 'courier' }],
      ['tenantId', { tenantId: 'tenant-2' }],
      ['userId', { userId: 'other-tenant-manager-1' }],
      ['managerId', { managerId: 'other-tenant-manager-1' }],
    ] as const)(
      'rejects invalid self-profile update body with %s',
      async (_label, body) => {
        await seedManagerProfileData();

        const response = await request(createApp())
          .patch('/api/staff/me')
          .send(body);

        expect(response.status).toBe(400);
        expect(response.body.error).toEqual({
          code: 'INVALID_STAFF_REQUEST',
          message: 'Staff request is invalid.',
        });
      }
    );

    it.each(['owner'] as const)(
      'rejects self-profile updates from %s users',
      async (role) => {
        await seedManagerProfileData();
        routeAuth.context = {
          userId: `${role}-1`,
          tenantId: 'tenant-1',
          role,
        };

        const response = await request(createApp())
          .patch('/api/staff/me')
          .send({ name: 'Blocked Update' });

        expect(response.status).toBe(403);
        expect(response.body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
        });
      }
    );

    it('rejects unauthenticated self-profile update requests', async () => {
      await seedManagerProfileData();
      routeAuth.context = null;

      const response = await request(createApp())
        .patch('/api/staff/me')
        .send({ name: 'Blocked Update' });

      expect(response.status).toBe(401);
      expect(response.body.error).toEqual({
        code: 'UNAUTHENTICATED',
        message: 'You must sign in to perform this action.',
      });
    });

    it('rejects self-profile updates without tenant membership', async () => {
      await seedManagerProfileData();
      routeAuth.context = 'missing-membership';

      const response = await request(createApp())
        .patch('/api/staff/me')
        .send({ name: 'Blocked Update' });

      expect(response.status).toBe(403);
      expect(response.body.error).toEqual({
        code: 'TENANT_MEMBERSHIP_REQUIRED',
        message:
          'Your account is not linked to a tenant. Contact support for help.',
      });
    });
  });

  describe('staff manager deletion routes', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      routeAuth.context = {
        userId: 'owner-1',
        tenantId: 'tenant-1',
        role: 'owner',
      };
      await resetTenantTestData();
    });

    it('allows an owner to delete a manager in their tenant', async () => {
      await seedManagerProfileData();

      const response = await request(createApp()).delete(
        '/api/staff/managers/manager-1'
      );

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });

    it.each(['manager', 'courier'] as const)(
      'rejects manager deletion from %s users',
      async (role) => {
        await seedManagerProfileData();
        routeAuth.context = {
          userId: `${role}-1`,
          tenantId: 'tenant-1',
          role,
        };

        const response = await request(createApp()).delete(
          '/api/staff/managers/manager-1'
        );

        expect(response.status).toBe(403);
        expect(response.body.error).toEqual({
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
        });
      }
    );

    it('rejects unauthenticated manager deletion requests', async () => {
      await seedManagerProfileData();
      routeAuth.context = null;

      const response = await request(createApp()).delete(
        '/api/staff/managers/manager-1'
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toEqual({
        code: 'UNAUTHENTICATED',
        message: 'You must sign in to perform this action.',
      });
    });

    it('rejects manager deletion for authenticated users without tenant membership', async () => {
      await seedManagerProfileData();
      routeAuth.context = 'missing-membership';

      const response = await request(createApp()).delete(
        '/api/staff/managers/manager-1'
      );

      expect(response.status).toBe(403);
      expect(response.body.error).toEqual({
        code: 'TENANT_MEMBERSHIP_REQUIRED',
        message:
          'Your account is not linked to a tenant. Contact support for help.',
      });
    });

    it.each([
      ['courier', 'courier-1'],
      ['owner', 'owner-target-1'],
      ['other tenant manager', 'other-tenant-manager-1'],
    ] as const)(
      'returns not found when deleting a %s',
      async (_label, managerId) => {
        await seedManagerProfileData();

        const response = await request(createApp()).delete(
          `/api/staff/managers/${managerId}`
        );

        expect(response.status).toBe(404);
        expect(response.body.error).toEqual({
          code: 'STAFF_MANAGER_NOT_FOUND',
          message: 'Manager could not be found.',
        });
      }
    );
  });
});
