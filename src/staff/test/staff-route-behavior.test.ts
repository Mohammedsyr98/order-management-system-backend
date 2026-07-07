import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ListCouriersResponse,
  ListManagersResponse,
  UpdateCourierProfileResponse,
  UpdateManagerProfileResponse,
  UpdateStaffProfileResponse,
} from '../../contracts/staff.js';
import { TenantRole } from '../../contracts/roles.js';

type RouteAuthContext = {
  userId: string;
  tenantId: string;
  role: TenantRole;
};

const routeAuth = vi.hoisted<{
  context: RouteAuthContext | null | 'missing-membership';
}>(() => ({
  context: {
    userId: 'owner-1',
    tenantId: 'tenant-1',
    role: 'owner',
  },
}));

vi.mock('../../auth/auth-context.js', () => ({
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

vi.mock('../staff-service.js', () => ({
  createStaff: vi.fn(),
  deleteCourier: vi.fn(),
  deleteManager: vi.fn(),
  listCouriers: vi.fn(),
  listManagers: vi.fn(),
  updateCourierProfile: vi.fn(),
  updateManagerProfile: vi.fn(),
  updateOwnStaffProfile: vi.fn(),
}));

const {
  createStaff,
  deleteCourier,
  deleteManager,
  listCouriers,
  listManagers,
  updateCourierProfile,
  updateManagerProfile,
  updateOwnStaffProfile,
} = await import('../staff-service.js');
const { staffRouter } = await import('../staff-routes.js');

const createStaffMock = vi.mocked(createStaff);
const deleteCourierMock = vi.mocked(deleteCourier);
const deleteManagerMock = vi.mocked(deleteManager);
const listCouriersMock = vi.mocked(listCouriers);
const listManagersMock = vi.mocked(listManagers);
const updateCourierProfileMock = vi.mocked(updateCourierProfile);
const updateManagerProfileMock = vi.mocked(updateManagerProfile);
const updateOwnStaffProfileMock = vi.mocked(updateOwnStaffProfile);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/staff', staffRouter);
  return app;
};

const staffRequest = {
  name: 'Staff User',
  email: 'staff@example.com',
  password: 'password123',
  role: 'manager',
  phone: '+15551234567',
};

const createdStaff = {
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
} as const;

const courierRequest = {
  ...staffRequest,
  role: 'courier',
  phone: '+15557654321',
} as const;

const createdCourier = {
  ...createdStaff,
  membership: {
    ...createdStaff.membership,
    role: 'courier',
    phone: '+15557654321',
  },
} as const;

const listedManagers: ListManagersResponse = {
  managers: [
    {
      id: 'manager-1',
      name: 'Manager User',
      email: 'manager@example.com',
      tenantId: 'tenant-1',
      role: 'manager',
      phone: '+15551234567',
    },
  ],
};

const listedCouriers: ListCouriersResponse = {
  couriers: [
    {
      id: 'courier-1',
      name: 'Courier User',
      email: 'courier@example.com',
      tenantId: 'tenant-1',
      role: 'courier',
      phone: '+15557654321',
    },
  ],
};

const updatedManager: UpdateManagerProfileResponse = {
  manager: {
    id: 'manager-1',
    name: 'Updated Manager',
    email: 'manager@example.com',
    tenantId: 'tenant-1',
    role: 'manager',
    phone: '+15551234567',
  },
};

const updatedCourier: UpdateCourierProfileResponse = {
  courier: {
    id: 'courier-1',
    name: 'Updated Courier',
    email: 'courier@example.com',
    tenantId: 'tenant-1',
    role: 'courier',
    phone: '+15557654321',
  },
};

const updatedStaff = {
  staff: updatedManager.manager,
};

const updatedCourierStaff: UpdateStaffProfileResponse = {
  staff: updatedCourier.courier,
};

describe('staff routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeAuth.context = {
      userId: 'owner-1',
      tenantId: 'tenant-1',
      role: 'owner',
    };
    createStaffMock.mockResolvedValue({
      ok: true,
      data: createdStaff,
    });
    deleteCourierMock.mockResolvedValue({ ok: true });
    deleteManagerMock.mockResolvedValue({ ok: true });
    listCouriersMock.mockResolvedValue(listedCouriers);
    listManagersMock.mockResolvedValue(listedManagers);
    updateCourierProfileMock.mockResolvedValue({
      ok: true,
      data: updatedCourier,
    });
    updateManagerProfileMock.mockResolvedValue({
      ok: true,
      data: updatedManager,
    });
    updateOwnStaffProfileMock.mockResolvedValue({
      ok: true,
      data: updatedStaff,
    });
  });

  it('lists managers for an owner tenant', async () => {
    const response = await request(createApp()).get('/api/staff/managers');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(listedManagers);
    expect(listManagersMock).toHaveBeenCalledWith('tenant-1');
  });

  it('lists couriers for an owner tenant', async () => {
    const response = await request(createApp()).get('/api/staff/couriers');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(listedCouriers);
    expect(listCouriersMock).toHaveBeenCalledWith('tenant-1');
  });

  it('lists couriers for a manager tenant', async () => {
    routeAuth.context = {
      userId: 'manager-1',
      tenantId: 'tenant-1',
      role: 'manager',
    };

    const response = await request(createApp()).get('/api/staff/couriers');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(listedCouriers);
    expect(listCouriersMock).toHaveBeenCalledWith('tenant-1');
  });

  it('rejects courier listing for courier users', async () => {
    routeAuth.context = {
      userId: 'courier-1',
      tenantId: 'tenant-1',
      role: 'courier',
    };

    const response = await request(createApp()).get('/api/staff/couriers');

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });
    expect(listCouriersMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated courier listing requests', async () => {
    routeAuth.context = null;

    const response = await request(createApp()).get('/api/staff/couriers');

    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'You must sign in to perform this action.',
    });
    expect(listCouriersMock).not.toHaveBeenCalled();
  });

  it('rejects courier listing for authenticated users without tenant membership', async () => {
    routeAuth.context = 'missing-membership';

    const response = await request(createApp()).get('/api/staff/couriers');

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'TENANT_MEMBERSHIP_REQUIRED',
      message:
        'Your account is not linked to a tenant. Contact support for help.',
    });
    expect(listCouriersMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated manager listing requests', async () => {
    routeAuth.context = null;

    const response = await request(createApp()).get('/api/staff/managers');

    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'You must sign in to perform this action.',
    });
    expect(listManagersMock).not.toHaveBeenCalled();
  });

  it('rejects manager listing for authenticated users without tenant membership', async () => {
    routeAuth.context = 'missing-membership';

    const response = await request(createApp()).get('/api/staff/managers');

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'TENANT_MEMBERSHIP_REQUIRED',
      message:
        'Your account is not linked to a tenant. Contact support for help.',
    });
    expect(listManagersMock).not.toHaveBeenCalled();
  });

  it.each(['manager', 'courier'] as const)(
    'rejects manager listing for %s users',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };

      const response = await request(createApp()).get('/api/staff/managers');

      expect(response.status).toBe(403);
      expect(response.body.error).toEqual({
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      });
      expect(listManagersMock).not.toHaveBeenCalled();
    }
  );

  it('updates a manager profile through the service and returns the updated manager payload', async () => {
    const requestBody = {
      name: 'Updated Manager',
      phone: '+15551234567',
    };

    const response = await request(createApp())
      .patch('/api/staff/managers/manager-1')
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(updatedManager);
    expect(updateManagerProfileMock).toHaveBeenCalledWith(
      'tenant-1',
      'manager-1',
      requestBody
    );
  });

  it('updates a courier profile through the service and returns the updated courier payload', async () => {
    const requestBody = {
      name: 'Updated Courier',
      phone: '+15557654321',
    };

    const response = await request(createApp())
      .patch('/api/staff/couriers/courier-1')
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(updatedCourier);
    expect(updateCourierProfileMock).toHaveBeenCalledWith(
      'tenant-1',
      'courier-1',
      requestBody
    );
  });

  it.each([
    ['INVALID_STAFF_REQUEST', 400, 'Staff request is invalid.'],
    ['STAFF_COURIER_NOT_FOUND', 404, 'Courier could not be found.'],
    ['STAFF_UPDATE_FAILED', 422, 'Staff account could not be updated.'],
  ] as const)(
    'maps %s courier update service failures to HTTP %i responses',
    async (errorCode, status, message) => {
      updateCourierProfileMock.mockResolvedValue({
        ok: false,
        errorCode,
      });

      const response = await request(createApp())
        .patch('/api/staff/couriers/courier-1')
        .send({
          name: 'Updated Courier',
        });

      expect(response.status).toBe(status);
      expect(response.body.error).toEqual({
        code: errorCode,
        message,
      });
    }
  );

  it.each([
    ['INVALID_STAFF_REQUEST', 400, 'Staff request is invalid.'],
    ['STAFF_MANAGER_NOT_FOUND', 404, 'Manager could not be found.'],
    ['STAFF_UPDATE_FAILED', 422, 'Staff account could not be updated.'],
  ] as const)(
    'maps %s manager update service failures to HTTP %i responses',
    async (errorCode, status, message) => {
      updateManagerProfileMock.mockResolvedValue({
        ok: false,
        errorCode,
      });

      const response = await request(createApp())
        .patch('/api/staff/managers/manager-1')
        .send({
          name: 'Updated Manager',
        });

      expect(response.status).toBe(status);
      expect(response.body.error).toEqual({
        code: errorCode,
        message,
      });
    }
  );

  it('updates the authenticated manager through the self-profile service', async () => {
    routeAuth.context = {
      userId: 'manager-1',
      tenantId: 'tenant-1',
      role: 'manager',
    };
    const requestBody = {
      name: 'Updated Manager',
      phone: '+15551234567',
    };

    const response = await request(createApp())
      .patch('/api/staff/me')
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(updatedStaff);
    expect(updateOwnStaffProfileMock).toHaveBeenCalledWith(
      routeAuth.context,
      requestBody
    );
  });

  it('updates the authenticated courier through the self-profile service', async () => {
    routeAuth.context = {
      userId: 'courier-1',
      tenantId: 'tenant-1',
      role: 'courier',
    };
    updateOwnStaffProfileMock.mockResolvedValue({
      ok: true,
      data: updatedCourierStaff,
    });
    const requestBody = {
      name: 'Updated Courier',
      phone: '+15557654321',
    };

    const response = await request(createApp())
      .patch('/api/staff/me')
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(updatedCourierStaff);
    expect(updateOwnStaffProfileMock).toHaveBeenCalledWith(
      routeAuth.context,
      requestBody
    );
  });

  it.each(['owner'] as const)(
    'rejects self-profile updates from %s users',
    async (role) => {
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
      expect(updateOwnStaffProfileMock).not.toHaveBeenCalled();
    }
  );

  it('rejects unauthenticated self-profile update requests', async () => {
    routeAuth.context = null;

    const response = await request(createApp())
      .patch('/api/staff/me')
      .send({ name: 'Blocked Update' });

    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'You must sign in to perform this action.',
    });
    expect(updateOwnStaffProfileMock).not.toHaveBeenCalled();
  });

  it('rejects self-profile updates without tenant membership', async () => {
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
    expect(updateOwnStaffProfileMock).not.toHaveBeenCalled();
  });

  it.each([
    ['INVALID_STAFF_REQUEST', 400, 'Staff request is invalid.'],
    ['STAFF_MANAGER_NOT_FOUND', 404, 'Manager could not be found.'],
    ['STAFF_COURIER_NOT_FOUND', 404, 'Courier could not be found.'],
    ['STAFF_UPDATE_FAILED', 422, 'Staff account could not be updated.'],
  ] as const)(
    'maps %s self-profile service failures to HTTP %i responses',
    async (errorCode, status, message) => {
      routeAuth.context = {
        userId: 'manager-1',
        tenantId: 'tenant-1',
        role: 'manager',
      };
      updateOwnStaffProfileMock.mockResolvedValue({
        ok: false,
        errorCode,
      });

      const response = await request(createApp())
        .patch('/api/staff/me')
        .send({ name: 'Updated Manager' });

      expect(response.status).toBe(status);
      expect(response.body.error).toEqual({
        code: errorCode,
        message,
      });
    }
  );

  it.each(['owner', 'manager'] as const)(
    'deletes a courier through the service for a %s tenant and returns no content',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };

      const response = await request(createApp()).delete(
        '/api/staff/couriers/courier-1'
      );

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(deleteCourierMock).toHaveBeenCalledWith('tenant-1', 'courier-1');
    }
  );

  it.each([
    ['STAFF_COURIER_NOT_FOUND', 404, 'Courier could not be found.'],
    ['STAFF_DELETE_FAILED', 422, 'Staff account could not be deleted.'],
  ] as const)(
    'maps %s courier deletion service failures to HTTP %i responses',
    async (errorCode, status, message) => {
      deleteCourierMock.mockResolvedValue({
        ok: false,
        errorCode,
      });

      const response = await request(createApp()).delete(
        '/api/staff/couriers/courier-1'
      );

      expect(response.status).toBe(status);
      expect(response.body.error).toEqual({
        code: errorCode,
        message,
      });
    }
  );

  it.each([
    [
      'courier users',
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
      'unauthenticated users',
      null,
      401,
      'UNAUTHENTICATED',
      'You must sign in to perform this action.',
    ],
    [
      'authenticated users without tenant membership',
      'missing-membership',
      403,
      'TENANT_MEMBERSHIP_REQUIRED',
      'Your account is not linked to a tenant. Contact support for help.',
    ],
  ] as const)(
    'rejects courier deletion for %s',
    async (_label, context, status, code, message) => {
      routeAuth.context = context;

      const response = await request(createApp()).delete(
        '/api/staff/couriers/courier-1'
      );

      expect(response.status).toBe(status);
      expect(response.body.error).toEqual({ code, message });
      expect(deleteCourierMock).not.toHaveBeenCalled();
    }
  );

  it('deletes a manager through the service and returns no content', async () => {
    const response = await request(createApp()).delete(
      '/api/staff/managers/manager-1'
    );

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(deleteManagerMock).toHaveBeenCalledWith('tenant-1', 'manager-1');
  });

  it.each([
    ['STAFF_MANAGER_NOT_FOUND', 404, 'Manager could not be found.'],
    ['STAFF_DELETE_FAILED', 422, 'Staff account could not be deleted.'],
  ] as const)(
    'maps %s manager deletion service failures to HTTP %i responses',
    async (errorCode, status, message) => {
      deleteManagerMock.mockResolvedValue({
        ok: false,
        errorCode,
      });

      const response = await request(createApp()).delete(
        '/api/staff/managers/manager-1'
      );

      expect(response.status).toBe(status);
      expect(response.body.error).toEqual({
        code: errorCode,
        message,
      });
    }
  );

  it('rejects unauthenticated staff creation requests', async () => {
    routeAuth.context = null;

    const response = await request(createApp())
      .post('/api/staff')
      .send(staffRequest);

    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'You must sign in to perform this action.',
    });
    expect(createStaffMock).not.toHaveBeenCalled();
  });

  it('rejects staff creation for authenticated users without tenant membership', async () => {
    routeAuth.context = 'missing-membership';

    const response = await request(createApp())
      .post('/api/staff')
      .send(staffRequest);

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({
      code: 'TENANT_MEMBERSHIP_REQUIRED',
      message:
        'Your account is not linked to a tenant. Contact support for help.',
    });
    expect(createStaffMock).not.toHaveBeenCalled();
  });

  it('creates staff through the service and returns the created staff payload', async () => {
    const requestBody = {
      ...staffRequest,
      tenantId: 'request-body-tenant',
    };

    const response = await request(createApp())
      .post('/api/staff')
      .send(requestBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(createdStaff);
    expect(createStaffMock).toHaveBeenCalledWith(
      routeAuth.context,
      requestBody
    );
  });

  it.each(['owner', 'manager'] as const)(
    'allows a %s to create a courier with a phone',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };
      createStaffMock.mockResolvedValue({
        ok: true,
        data: createdCourier,
      });

      const response = await request(createApp())
        .post('/api/staff')
        .send(courierRequest);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(createdCourier);
      expect(createStaffMock).toHaveBeenCalledWith(
        routeAuth.context,
        courierRequest
      );
    }
  );

  it.each([
    ['INVALID_STAFF_REQUEST', 400, 'Staff request is invalid.'],
    ['FORBIDDEN', 403, 'You do not have permission to perform this action.'],
    [
      'STAFF_EMAIL_ALREADY_EXISTS',
      422,
      'A user with this email already exists.',
    ],
    ['STAFF_CREATION_FAILED', 422, 'Staff account could not be created.'],
  ] as const)(
    'maps %s service failures to HTTP %i responses',
    async (errorCode, status, message) => {
      createStaffMock.mockResolvedValue({
        ok: false,
        errorCode,
      });

      const response = await request(createApp())
        .post('/api/staff')
        .send(staffRequest);

      expect(response.status).toBe(status);
      expect(response.body.error).toEqual({
        code: errorCode,
        message,
      });
    }
  );
});
