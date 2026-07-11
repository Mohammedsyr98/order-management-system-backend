import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedAuthContext } from '../../auth/auth-context.js';
import type { FixedPriceProductResponse } from '../../contracts/menu.js';

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
  createFixedPriceProduct: vi.fn(),
  createMenuCategory: vi.fn(),
  deleteFixedPriceProduct: vi.fn(),
  deleteMenuCategory: vi.fn(),
  listMenuCategories: vi.fn(),
  updateFixedPriceProduct: vi.fn(),
  updateMenuCategory: vi.fn(),
}));

const {
  createFixedPriceProduct,
  deleteFixedPriceProduct,
  updateFixedPriceProduct,
} = await import('../menu-service.js');
const { menuRouter } = await import('../menu-routes.js');

const createFixedPriceProductMock = vi.mocked(createFixedPriceProduct);
const deleteFixedPriceProductMock = vi.mocked(deleteFixedPriceProduct);
const updateFixedPriceProductMock = vi.mocked(updateFixedPriceProduct);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/menu', menuRouter);
  return app;
};

const productPayload: FixedPriceProductResponse = {
  product: {
    id: 'product-1',
    categoryId: 'category-1',
    name: 'Ayran',
    description: null,
    isAvailable: true,
    price: '30.00',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

type MenuMethod = 'post' | 'put' | 'delete';

const sendMenuRequest = (
  method: MenuMethod,
  path: string,
  body?: Record<string, unknown>
) => {
  const appRequest = request(createApp());
  const pendingRequest =
    method === 'post'
      ? appRequest.post(path)
      : method === 'put'
        ? appRequest.put(path)
        : appRequest.delete(path);

  return body === undefined ? pendingRequest : pendingRequest.send(body);
};

describe('fixed-price product routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeAuth.context = {
      userId: 'owner-1',
      tenantId: 'tenant-1',
      role: 'owner',
    };
    createFixedPriceProductMock.mockResolvedValue({
      ok: true,
      data: productPayload,
    });
    updateFixedPriceProductMock.mockResolvedValue({
      ok: true,
      data: productPayload,
    });
    deleteFixedPriceProductMock.mockResolvedValue({ ok: true });
  });

  it.each(['owner', 'manager'] as const)(
    'creates a fixed-price product for a %s tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };
      const requestBody = {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        price: '30.00',
      };

      const response = await request(createApp())
        .post('/api/menu/categories/category-1/products')
        .send(requestBody);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(productPayload);
      expect(createFixedPriceProductMock).toHaveBeenCalledWith(
        'tenant-1',
        'category-1',
        requestBody
      );
    }
  );

  it.each(['owner', 'manager'] as const)(
    'updates a fixed-price product for a %s tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };
      const requestBody = {
        name: 'Ayran',
        description: 'Cold yogurt drink',
        isAvailable: false,
        price: '30.75',
      };

      const response = await request(createApp())
        .put('/api/menu/products/product-1')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(productPayload);
      expect(updateFixedPriceProductMock).toHaveBeenCalledWith(
        'tenant-1',
        'product-1',
        requestBody
      );
    }
  );

  it.each(['owner', 'manager'] as const)(
    'deletes a fixed-price product for a %s tenant',
    async (role) => {
      routeAuth.context = {
        userId: `${role}-1`,
        tenantId: 'tenant-1',
        role,
      };

      const response = await request(createApp()).delete(
        '/api/menu/products/product-1'
      );

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(deleteFixedPriceProductMock).toHaveBeenCalledWith(
        'tenant-1',
        'product-1'
      );
    }
  );

  it.each([
    [
      'create',
      () => {
        createFixedPriceProductMock.mockResolvedValue({
          ok: false,
          errorCode: 'INVALID_MENU_PRODUCT_REQUEST',
        });
        return request(createApp())
          .post('/api/menu/categories/category-1/products')
          .send({ name: 'Ayran', price: 'abc' });
      },
      400,
      'INVALID_MENU_PRODUCT_REQUEST',
      'Menu product request is invalid.',
    ],
    [
      'create missing category',
      () => {
        createFixedPriceProductMock.mockResolvedValue({
          ok: false,
          errorCode: 'MENU_CATEGORY_NOT_FOUND',
        });
        return request(createApp())
          .post('/api/menu/categories/missing-category/products')
          .send({ name: 'Ayran', price: '30.00' });
      },
      404,
      'MENU_CATEGORY_NOT_FOUND',
      'Menu category could not be found.',
    ],
    [
      'update duplicate name',
      () => {
        updateFixedPriceProductMock.mockResolvedValue({
          ok: false,
          errorCode: 'MENU_PRODUCT_NAME_ALREADY_EXISTS',
        });
        return request(createApp()).put('/api/menu/products/product-1').send({
          name: 'Ayran',
          description: null,
          isAvailable: true,
          price: '30.00',
        });
      },
      422,
      'MENU_PRODUCT_NAME_ALREADY_EXISTS',
      'A menu product with this name already exists in this category.',
    ],
    [
      'delete missing product',
      () => {
        deleteFixedPriceProductMock.mockResolvedValue({
          ok: false,
          errorCode: 'MENU_PRODUCT_NOT_FOUND',
        });
        return request(createApp()).delete('/api/menu/products/product-1');
      },
      404,
      'MENU_PRODUCT_NOT_FOUND',
      'Menu product could not be found.',
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
    [
      'create',
      'post',
      '/api/menu/categories/category-1/products',
      { name: 'Ayran', price: '30.00' },
    ],
    [
      'update',
      'put',
      '/api/menu/products/product-1',
      {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        price: '30.00',
      },
    ],
    ['delete', 'delete', '/api/menu/products/product-1', undefined],
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
      expect(createFixedPriceProductMock).not.toHaveBeenCalled();
      expect(updateFixedPriceProductMock).not.toHaveBeenCalled();
      expect(deleteFixedPriceProductMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    [
      'create',
      'post',
      '/api/menu/categories/category-1/products',
      { name: 'Ayran', price: '30.00' },
    ],
    [
      'update',
      'put',
      '/api/menu/products/product-1',
      {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        price: '30.00',
      },
    ],
    ['delete', 'delete', '/api/menu/products/product-1', undefined],
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
      expect(createFixedPriceProductMock).not.toHaveBeenCalled();
      expect(updateFixedPriceProductMock).not.toHaveBeenCalled();
      expect(deleteFixedPriceProductMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    [
      'create',
      'post',
      '/api/menu/categories/category-1/products',
      { name: 'Ayran', price: '30.00' },
    ],
    [
      'update',
      'put',
      '/api/menu/products/product-1',
      {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        price: '30.00',
      },
    ],
    ['delete', 'delete', '/api/menu/products/product-1', undefined],
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
      expect(createFixedPriceProductMock).not.toHaveBeenCalled();
      expect(updateFixedPriceProductMock).not.toHaveBeenCalled();
      expect(deleteFixedPriceProductMock).not.toHaveBeenCalled();
    }
  );
});
