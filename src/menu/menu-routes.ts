import { Router, type Response } from 'express';

import {
  requireAuthContext,
  requireManagerAccess,
  type ResolvedAuthContext,
} from '../auth/auth-context.js';
import type { MenuCategoryRequest } from '../contracts/menu.js';
import { sendApiError } from '../http/api-errors.js';
import {
  createMenuAddOnGroup,
  createMenuProduct,
  createMenuCategory,
  deleteMenuAddOnGroup,
  deleteMenuProduct,
  deleteMenuCategory,
  listMenuAddOnGroups,
  listMenuCategories,
  updateMenuAddOnGroup,
  updateMenuProduct,
  updateMenuCategory,
} from './menu-service.js';
import type {
  MenuAddOnGroupRouteErrorCode,
  MenuProductRouteErrorCode,
  MenuCategoryRouteErrorCode,
} from './menu-types.js';
import type {
  MenuAddOnGroupRequest,
  MenuProductRequest,
} from '../contracts/menu.js';

export const menuRouter = Router();

const sendMenuCategoryError = (
  res: Response,
  errorCode: MenuCategoryRouteErrorCode
) => {
  const status =
    errorCode === 'INVALID_MENU_CATEGORY_REQUEST'
      ? 400
      : errorCode === 'MENU_CATEGORY_NOT_FOUND'
        ? 404
        : 422;

  sendApiError(res, status, errorCode);
};

const sendMenuProductError = (
  res: Response,
  errorCode: MenuProductRouteErrorCode
) => {
  const status =
    errorCode === 'INVALID_MENU_PRODUCT_REQUEST'
      ? 400
      : errorCode === 'MENU_CATEGORY_NOT_FOUND' ||
          errorCode === 'MENU_PRODUCT_NOT_FOUND'
        ? 404
        : 422;

  sendApiError(res, status, errorCode);
};

const sendMenuAddOnGroupError = (
  res: Response,
  errorCode: MenuAddOnGroupRouteErrorCode
) => {
  const status =
    errorCode === 'INVALID_MENU_ADD_ON_GROUP_REQUEST'
      ? 400
      : errorCode === 'MENU_ADD_ON_GROUP_NOT_FOUND'
        ? 404
        : 422;

  sendApiError(res, status, errorCode);
};

menuRouter.get(
  '/categories',
  requireAuthContext,
  requireManagerAccess,
  async (_req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const result = await listMenuCategories(context.tenantId);

    res.json(result.data);
  }
);

menuRouter.get(
  '/add-on-groups',
  requireAuthContext,
  requireManagerAccess,
  async (_req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const result = await listMenuAddOnGroups(context.tenantId);

    res.json(result.data);
  }
);

menuRouter.post(
  '/categories',
  requireAuthContext,
  requireManagerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const result = await createMenuCategory(
      context.tenantId,
      req.body as MenuCategoryRequest
    );

    if (!result.ok) {
      sendMenuCategoryError(res, result.errorCode);
      return;
    }

    res.status(201).json(result.data);
  }
);

menuRouter.post(
  '/add-on-groups',
  requireAuthContext,
  requireManagerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const result = await createMenuAddOnGroup(
      context.tenantId,
      req.body as MenuAddOnGroupRequest
    );

    if (!result.ok) {
      sendMenuAddOnGroupError(res, result.errorCode);
      return;
    }

    res.status(201).json(result.data);
  }
);

menuRouter.post(
  '/categories/:categoryId/products',
  requireAuthContext,
  requireManagerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const { categoryId } = req.params;

    if (typeof categoryId !== 'string') {
      sendApiError(res, 400, 'INVALID_MENU_PRODUCT_REQUEST');
      return;
    }

    const result = await createMenuProduct(
      context.tenantId,
      categoryId,
      req.body as MenuProductRequest
    );

    if (!result.ok) {
      sendMenuProductError(res, result.errorCode);
      return;
    }

    res.status(201).json(result.data);
  }
);

menuRouter.put(
  '/add-on-groups/:addOnGroupId',
  requireAuthContext,
  requireManagerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const { addOnGroupId } = req.params;

    if (typeof addOnGroupId !== 'string') {
      sendApiError(res, 400, 'INVALID_MENU_ADD_ON_GROUP_REQUEST');
      return;
    }

    const result = await updateMenuAddOnGroup(
      context.tenantId,
      addOnGroupId,
      req.body as MenuAddOnGroupRequest
    );

    if (!result.ok) {
      sendMenuAddOnGroupError(res, result.errorCode);
      return;
    }

    res.json(result.data);
  }
);

menuRouter.put(
  '/categories/:categoryId',
  requireAuthContext,
  requireManagerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const { categoryId } = req.params;

    if (typeof categoryId !== 'string') {
      sendApiError(res, 400, 'INVALID_MENU_CATEGORY_REQUEST');
      return;
    }

    const result = await updateMenuCategory(
      context.tenantId,
      categoryId,
      req.body as MenuCategoryRequest
    );

    if (!result.ok) {
      sendMenuCategoryError(res, result.errorCode);
      return;
    }

    res.json(result.data);
  }
);

menuRouter.put(
  '/products/:productId',
  requireAuthContext,
  requireManagerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const { productId } = req.params;

    if (typeof productId !== 'string') {
      sendApiError(res, 400, 'INVALID_MENU_PRODUCT_REQUEST');
      return;
    }

    const result = await updateMenuProduct(
      context.tenantId,
      productId,
      req.body as MenuProductRequest
    );

    if (!result.ok) {
      sendMenuProductError(res, result.errorCode);
      return;
    }

    res.json(result.data);
  }
);

menuRouter.delete(
  '/add-on-groups/:addOnGroupId',
  requireAuthContext,
  requireManagerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const { addOnGroupId } = req.params;

    if (typeof addOnGroupId !== 'string') {
      sendApiError(res, 400, 'INVALID_MENU_ADD_ON_GROUP_REQUEST');
      return;
    }

    const result = await deleteMenuAddOnGroup(context.tenantId, addOnGroupId);

    if (!result.ok) {
      sendMenuAddOnGroupError(res, result.errorCode);
      return;
    }

    res.status(204).end();
  }
);

menuRouter.delete(
  '/categories/:categoryId',
  requireAuthContext,
  requireManagerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const { categoryId } = req.params;

    if (typeof categoryId !== 'string') {
      sendApiError(res, 400, 'INVALID_MENU_CATEGORY_REQUEST');
      return;
    }

    const result = await deleteMenuCategory(context.tenantId, categoryId);

    if (!result.ok) {
      sendMenuCategoryError(res, result.errorCode);
      return;
    }

    res.status(204).end();
  }
);

menuRouter.delete(
  '/products/:productId',
  requireAuthContext,
  requireManagerAccess,
  async (req, res) => {
    const context = res.locals.authContext as ResolvedAuthContext;
    const { productId } = req.params;

    if (typeof productId !== 'string') {
      sendApiError(res, 400, 'INVALID_MENU_PRODUCT_REQUEST');
      return;
    }

    const result = await deleteMenuProduct(context.tenantId, productId);

    if (!result.ok) {
      sendMenuProductError(res, result.errorCode);
      return;
    }

    res.status(204).end();
  }
);
