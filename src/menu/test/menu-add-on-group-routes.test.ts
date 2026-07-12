import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedAuthContext } from '../../auth/auth-context.js';
import type {
  ListMenuAddOnGroupsResponse,
  MenuAddOnGroupResponse,
} from '../../contracts/menu.js';

const routeAuth = vi.hoisted<{
  context: ResolvedAuthContext | null | 'missing-membership';
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
  requireManagerAccess: vi.fn((_req, res, next) => {
    const context = res.locals.authContext as ResolvedAuthContext | undefined;

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
    const context = res.locals.authContext as ResolvedAuthContext | undefined;

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
    (allowedRoles: ResolvedAuthContext['role'][]) =>
      (_req: Request, res: Response, next: NextFunction) => {
        const context = res.locals.authContext as
          | ResolvedAuthContext
          | undefined;

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

vi.mock('../menu-service.js', () => ({
  createMenuAddOnGroup: vi.fn(),
  createMenuProduct: vi.fn(),
  createMenuCategory: vi.fn(),
  deleteMenuAddOnGroup: vi.fn(),
  deleteMenuProduct: vi.fn(),
  deleteMenuCategory: vi.fn(),
  listMenuAddOnGroups: vi.fn(),
  listMenuCategories: vi.fn(),
  updateMenuAddOnGroup: vi.fn(),
  updateMenuProduct: vi.fn(),
  updateMenuCategory: vi.fn(),
}));

const {
  createMenuAddOnGroup,
  deleteMenuAddOnGroup,
  listMenuAddOnGroups,
  updateMenuAddOnGroup,
} = await import('../menu-service.js');
const { menuRouter } = await import('../menu-routes.js');

const createMenuAddOnGroupMock = vi.mocked(createMenuAddOnGroup);
const deleteMenuAddOnGroupMock = vi.mocked(deleteMenuAddOnGroup);
const listMenuAddOnGroupsMock = vi.mocked(listMenuAddOnGroups);
const updateMenuAddOnGroupMock = vi.mocked(updateMenuAddOnGroup);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/menu', menuRouter);
  return app;
};

const listedAddOnGroups: ListMenuAddOnGroupsResponse = {
  addOnGroups: [
    {
      id: 'add-on-group-1',
      tenantId: 'tenant-1',
      name: 'Drinks',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      items: [
        {
          id: 'add-on-item-1',
          groupId: 'add-on-group-1',
          name: 'Ayran',
          price: '30.00',
          isAvailable: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
  ],
};

const addOnGroupPayload: MenuAddOnGroupResponse = {
  addOnGroup: listedAddOnGroups.addOnGroups[0],
};

type MenuMethod = 'get' | 'post' | 'put' | 'delete';

const sendMenuRequest = (
  method: MenuMethod,
  path: string,
  body?: Record<string, unknown>
) => {
  const appRequest = request(createApp());
  const pendingRequest =
    method === 'get'
      ? appRequest.get(path)
      : method === 'post'
        ? appRequest.post(path)
        : method === 'put'
          ? appRequest.put(path)
          : appRequest.delete(path);

  return body === undefined ? pendingRequest : pendingRequest.send(body);
};

describe('menu add-on group routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeAuth.context = {
      userId: 'owner-1',
      tenantId: 'tenant-1',
      role: 'owner',
    };
    listMenuAddOnGroupsMock.mockResolvedValue({
      ok: true,
      data: listedAddOnGroups,
    });
    createMenuAddOnGroupMock.mockResolvedValue({
      ok: true,
      data: addOnGroupPayload,
    });
    updateMenuAddOnGroupMock.mockResolvedValue({
      ok: true,
      data: addOnGroupPayload,
    });
    deleteMenuAddOnGroupMock.mockResolvedValue({ ok: true });
  });

  it.each(['owner', 'manager'] as const)(
    'lists add-on groups for a %s tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };

      const response = await request(createApp()).get(
        '/api/menu/add-on-groups'
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(listedAddOnGroups);
      expect(listMenuAddOnGroupsMock).toHaveBeenCalledWith('tenant-1');
    }
  );

  it.each(['owner', 'manager'] as const)(
    'creates an add-on group for a %s tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };
      const requestBody = {
        name: 'Drinks',
        items: [{ name: 'Ayran', price: '30.00' }],
      };

      const response = await request(createApp())
        .post('/api/menu/add-on-groups')
        .send(requestBody);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(addOnGroupPayload);
      expect(createMenuAddOnGroupMock).toHaveBeenCalledWith(
        'tenant-1',
        requestBody
      );
    }
  );

  it.each(['owner', 'manager'] as const)(
    'updates an add-on group for a %s tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };
      const requestBody = {
        name: 'Extras',
        items: [{ name: 'Hot sauce', price: '0.00', isAvailable: false }],
      };

      const response = await request(createApp())
        .put('/api/menu/add-on-groups/add-on-group-1')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(addOnGroupPayload);
      expect(updateMenuAddOnGroupMock).toHaveBeenCalledWith(
        'tenant-1',
        'add-on-group-1',
        requestBody
      );
    }
  );

  it.each(['owner', 'manager'] as const)(
    'deletes an add-on group for a %s tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };

      const response = await request(createApp()).delete(
        '/api/menu/add-on-groups/add-on-group-1'
      );

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(deleteMenuAddOnGroupMock).toHaveBeenCalledWith(
        'tenant-1',
        'add-on-group-1'
      );
    }
  );

  it.each([
    [
      'create',
      () => {
        createMenuAddOnGroupMock.mockResolvedValue({
          ok: false,
          errorCode: 'INVALID_MENU_ADD_ON_GROUP_REQUEST',
        });
        return request(createApp())
          .post('/api/menu/add-on-groups')
          .send({ name: 'Drinks', items: [] });
      },
      400,
      'INVALID_MENU_ADD_ON_GROUP_REQUEST',
      'Menu add-on group request is invalid.',
    ],
    [
      'update missing group',
      () => {
        updateMenuAddOnGroupMock.mockResolvedValue({
          ok: false,
          errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND',
        });
        return request(createApp())
          .put('/api/menu/add-on-groups/missing-group')
          .send({
            name: 'Drinks',
            items: [{ name: 'Ayran', price: '30.00', isAvailable: true }],
          });
      },
      404,
      'MENU_ADD_ON_GROUP_NOT_FOUND',
      'Menu add-on group could not be found.',
    ],
    [
      'delete failure',
      () => {
        deleteMenuAddOnGroupMock.mockResolvedValue({
          ok: false,
          errorCode: 'MENU_ADD_ON_GROUP_DELETE_FAILED',
        });
        return request(createApp()).delete(
          '/api/menu/add-on-groups/add-on-group-1'
        );
      },
      422,
      'MENU_ADD_ON_GROUP_DELETE_FAILED',
      'Menu add-on group could not be deleted.',
    ],
  ] as const)(
    'maps %s service failures to HTTP %i responses',
    async (_label, sendRequest, status, code, message) => {
      const response = await sendRequest();

      expect(response.status).toBe(status);
      expect(response.body.error).toEqual({ code, message });
    }
  );

  it.each([
    ['list', 'get', '/api/menu/add-on-groups', undefined],
    [
      'create',
      'post',
      '/api/menu/add-on-groups',
      { name: 'Drinks', items: [{ name: 'Ayran', price: '30.00' }] },
    ],
    [
      'update',
      'put',
      '/api/menu/add-on-groups/add-on-group-1',
      {
        name: 'Drinks',
        items: [{ name: 'Ayran', price: '30.00', isAvailable: true }],
      },
    ],
    ['delete', 'delete', '/api/menu/add-on-groups/add-on-group-1', undefined],
  ] as const)(
    'rejects %s requests from courier users',
    async (_label, method, path, body) => {
      routeAuth.context = {
        userId: 'courier-1',
        tenantId: 'tenant-1',
        role: 'courier',
      };

      const response = await sendMenuRequest(method, path, body);

      expect(response.status).toBe(403);
      expect(response.body.error).toEqual({
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      });
      expect(listMenuAddOnGroupsMock).not.toHaveBeenCalled();
      expect(createMenuAddOnGroupMock).not.toHaveBeenCalled();
      expect(updateMenuAddOnGroupMock).not.toHaveBeenCalled();
      expect(deleteMenuAddOnGroupMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['list', 'get', '/api/menu/add-on-groups', undefined],
    [
      'create',
      'post',
      '/api/menu/add-on-groups',
      { name: 'Drinks', items: [{ name: 'Ayran', price: '30.00' }] },
    ],
    [
      'update',
      'put',
      '/api/menu/add-on-groups/add-on-group-1',
      {
        name: 'Drinks',
        items: [{ name: 'Ayran', price: '30.00', isAvailable: true }],
      },
    ],
    ['delete', 'delete', '/api/menu/add-on-groups/add-on-group-1', undefined],
  ] as const)(
    'rejects %s requests from unauthenticated users',
    async (_label, method, path, body) => {
      routeAuth.context = null;

      const response = await sendMenuRequest(method, path, body);

      expect(response.status).toBe(401);
      expect(response.body.error).toEqual({
        code: 'UNAUTHENTICATED',
        message: 'You must sign in to perform this action.',
      });
      expect(listMenuAddOnGroupsMock).not.toHaveBeenCalled();
      expect(createMenuAddOnGroupMock).not.toHaveBeenCalled();
      expect(updateMenuAddOnGroupMock).not.toHaveBeenCalled();
      expect(deleteMenuAddOnGroupMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['list', 'get', '/api/menu/add-on-groups', undefined],
    [
      'create',
      'post',
      '/api/menu/add-on-groups',
      { name: 'Drinks', items: [{ name: 'Ayran', price: '30.00' }] },
    ],
    [
      'update',
      'put',
      '/api/menu/add-on-groups/add-on-group-1',
      {
        name: 'Drinks',
        items: [{ name: 'Ayran', price: '30.00', isAvailable: true }],
      },
    ],
    ['delete', 'delete', '/api/menu/add-on-groups/add-on-group-1', undefined],
  ] as const)(
    'rejects %s requests from authenticated users without tenant membership',
    async (_label, method, path, body) => {
      routeAuth.context = 'missing-membership';

      const response = await sendMenuRequest(method, path, body);

      expect(response.status).toBe(403);
      expect(response.body.error).toEqual({
        code: 'TENANT_MEMBERSHIP_REQUIRED',
        message:
          'Your account is not linked to a tenant. Contact support for help.',
      });
      expect(listMenuAddOnGroupsMock).not.toHaveBeenCalled();
      expect(createMenuAddOnGroupMock).not.toHaveBeenCalled();
      expect(updateMenuAddOnGroupMock).not.toHaveBeenCalled();
      expect(deleteMenuAddOnGroupMock).not.toHaveBeenCalled();
    }
  );
});
