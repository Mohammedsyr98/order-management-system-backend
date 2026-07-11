import { Router, type Response } from 'express';

import {
  requireAuthContext,
  requireManagerAccess,
  type ResolvedAuthContext,
} from '../auth/auth-context.js';
import type { MenuCategoryRequest } from '../contracts/menu.js';
import { sendApiError } from '../http/api-errors.js';
import {
  createMenuCategory,
  deleteMenuCategory,
  listMenuCategories,
  updateMenuCategory,
} from './menu-service.js';
import type { MenuCategoryRouteErrorCode } from './menu-types.js';

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
