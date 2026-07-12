import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedAuthContext } from '../../auth/auth-context.js';
import type {
  ListMenuCategoriesResponse,
  MenuCategoryResponse,
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
  createMenuProduct: vi.fn(),
  createMenuCategory: vi.fn(),
  deleteMenuProduct: vi.fn(),
  deleteMenuCategory: vi.fn(),
  listMenuCategories: vi.fn(),
  updateMenuProduct: vi.fn(),
  updateMenuCategory: vi.fn(),
}));

const {
  createMenuCategory,
  deleteMenuCategory,
  listMenuCategories,
  updateMenuCategory,
} = await import('../menu-service.js');
const { menuRouter } = await import('../menu-routes.js');

const createMenuCategoryMock = vi.mocked(createMenuCategory);
const deleteMenuCategoryMock = vi.mocked(deleteMenuCategory);
const listMenuCategoriesMock = vi.mocked(listMenuCategories);
const updateMenuCategoryMock = vi.mocked(updateMenuCategory);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/menu', menuRouter);
  return app;
};

const listedCategories: ListMenuCategoriesResponse = {
  categories: [
    {
      id: 'category-1',
      tenantId: 'tenant-1',
      name: 'Mains',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      products: [],
    },
  ],
};

const categoryPayload: MenuCategoryResponse = {
  category: listedCategories.categories[0],
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

describe('menu category routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeAuth.context = {
      userId: 'owner-1',
      tenantId: 'tenant-1',
      role: 'owner',
    };
    listMenuCategoriesMock.mockResolvedValue({
      ok: true,
      data: listedCategories,
    });
    createMenuCategoryMock.mockResolvedValue({
      ok: true,
      data: categoryPayload,
    });
    updateMenuCategoryMock.mockResolvedValue({
      ok: true,
      data: categoryPayload,
    });
    deleteMenuCategoryMock.mockResolvedValue({ ok: true });
  });

  it.each(['owner', 'manager'] as const)(
    'lists categories for a %s tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };

      const response = await request(createApp()).get('/api/menu/categories');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(listedCategories);
      expect(listMenuCategoriesMock).toHaveBeenCalledWith('tenant-1');
    }
  );

  it.each(['owner', 'manager'] as const)(
    'creates a category for a %s tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };
      const requestBody = { name: 'Mains' };

      const response = await request(createApp())
        .post('/api/menu/categories')
        .send(requestBody);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(categoryPayload);
      expect(createMenuCategoryMock).toHaveBeenCalledWith(
        'tenant-1',
        requestBody
      );
    }
  );

  it.each(['owner', 'manager'] as const)(
    'updates a category for a %s tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };
      const requestBody = { name: 'Specials' };

      const response = await request(createApp())
        .put('/api/menu/categories/category-1')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(categoryPayload);
      expect(updateMenuCategoryMock).toHaveBeenCalledWith(
        'tenant-1',
        'category-1',
        requestBody
      );
    }
  );

  it.each(['owner', 'manager'] as const)(
    'deletes a category for a %s tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };

      const response = await request(createApp()).delete(
        '/api/menu/categories/category-1'
      );

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(deleteMenuCategoryMock).toHaveBeenCalledWith(
        'tenant-1',
        'category-1'
      );
    }
  );

  it.each([
    [
      'create',
      () => {
        createMenuCategoryMock.mockResolvedValue({
          ok: false,
          errorCode: 'INVALID_MENU_CATEGORY_REQUEST',
        });
        return request(createApp())
          .post('/api/menu/categories')
          .send({ name: '   ' });
      },
      400,
      'INVALID_MENU_CATEGORY_REQUEST',
      'Menu category request is invalid.',
    ],
    [
      'update',
      () => {
        updateMenuCategoryMock.mockResolvedValue({
          ok: false,
          errorCode: 'MENU_CATEGORY_NOT_FOUND',
        });
        return request(createApp())
          .put('/api/menu/categories/category-1')
          .send({ name: 'Mains' });
      },
      404,
      'MENU_CATEGORY_NOT_FOUND',
      'Menu category could not be found.',
    ],
    [
      'delete',
      () => {
        deleteMenuCategoryMock.mockResolvedValue({
          ok: false,
          errorCode: 'MENU_CATEGORY_DELETE_FAILED',
        });
        return request(createApp()).delete('/api/menu/categories/category-1');
      },
      422,
      'MENU_CATEGORY_DELETE_FAILED',
      'Menu category could not be deleted.',
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
    ['list', 'get', '/api/menu/categories', undefined],
    ['create', 'post', '/api/menu/categories', { name: 'Mains' }],
    ['update', 'put', '/api/menu/categories/category-1', { name: 'Mains' }],
    ['delete', 'delete', '/api/menu/categories/category-1', undefined],
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
      expect(listMenuCategoriesMock).not.toHaveBeenCalled();
      expect(createMenuCategoryMock).not.toHaveBeenCalled();
      expect(updateMenuCategoryMock).not.toHaveBeenCalled();
      expect(deleteMenuCategoryMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['list', 'get', '/api/menu/categories', undefined],
    ['create', 'post', '/api/menu/categories', { name: 'Mains' }],
    ['update', 'put', '/api/menu/categories/category-1', { name: 'Mains' }],
    ['delete', 'delete', '/api/menu/categories/category-1', undefined],
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
      expect(listMenuCategoriesMock).not.toHaveBeenCalled();
      expect(createMenuCategoryMock).not.toHaveBeenCalled();
      expect(updateMenuCategoryMock).not.toHaveBeenCalled();
      expect(deleteMenuCategoryMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['list', 'get', '/api/menu/categories', undefined],
    ['create', 'post', '/api/menu/categories', { name: 'Mains' }],
    ['update', 'put', '/api/menu/categories/category-1', { name: 'Mains' }],
    ['delete', 'delete', '/api/menu/categories/category-1', undefined],
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
      expect(listMenuCategoriesMock).not.toHaveBeenCalled();
      expect(createMenuCategoryMock).not.toHaveBeenCalled();
      expect(updateMenuCategoryMock).not.toHaveBeenCalled();
      expect(deleteMenuCategoryMock).not.toHaveBeenCalled();
    }
  );
});
