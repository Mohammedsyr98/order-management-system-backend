import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ListManagersResponse,
  UpdateManagerProfileResponse,
} from '../contracts/staff.js';

type RouteAuthContext = {
  userId: string;
  tenantId: string;
  role: 'owner' | 'manager' | 'courier';
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

vi.mock('./staff-service.js', () => ({
  createStaff: vi.fn(),
  deleteManager: vi.fn(),
  listManagers: vi.fn(),
  updateManagerProfile: vi.fn(),
}));

const { createStaff, deleteManager, listManagers, updateManagerProfile } =
  await import('./staff-service.js');
const { staffRouter } = await import('./staff-routes.js');

const createStaffMock = vi.mocked(createStaff);
const deleteManagerMock = vi.mocked(deleteManager);
const listManagersMock = vi.mocked(listManagers);
const updateManagerProfileMock = vi.mocked(updateManagerProfile);

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
    deleteManagerMock.mockResolvedValue({ ok: true });
    listManagersMock.mockResolvedValue(listedManagers);
    updateManagerProfileMock.mockResolvedValue({
      ok: true,
      data: updatedManager,
    });
  });

  it('lists managers for an owner tenant', async () => {
    const response = await request(createApp()).get('/api/staff/managers');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(listedManagers);
    expect(listManagersMock).toHaveBeenCalledWith('tenant-1');
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
