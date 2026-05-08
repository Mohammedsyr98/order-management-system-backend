import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
}));

vi.mock('./staff-service.js', () => ({
  createStaff: vi.fn(),
}));

const { createStaff } = await import('./staff-service.js');
const { staffRouter } = await import('./staff-routes.js');

const createStaffMock = vi.mocked(createStaff);

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
  });

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
    ['INVALID_STAFF_ROLE', 400, 'Staff role must be manager or courier.'],
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
