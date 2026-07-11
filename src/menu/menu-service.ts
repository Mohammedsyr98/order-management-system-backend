import { randomUUID } from 'node:crypto';

import { and, asc, eq } from 'drizzle-orm';

import type { MenuCategoryRequest } from '../contracts/menu.js';
import { isUniqueConstraintViolation } from '../db/db-errors.js';
import { db } from '../db/index.js';
import { menuCategories } from '../db/schema.js';
import type {
  CreateMenuCategoryResult,
  DeleteMenuCategoryResult,
  ListMenuCategoriesResult,
  UpdateMenuCategoryResult,
} from './menu-types.js';
import { parseMenuCategoryRequest } from './menu-validation.js';

type PersistedMenuCategory = typeof menuCategories.$inferSelect;

const menuCategorySelect = {
  id: menuCategories.id,
  tenantId: menuCategories.tenantId,
  name: menuCategories.name,
  createdAt: menuCategories.createdAt,
  updatedAt: menuCategories.updatedAt,
};

const serializeMenuCategory = (category: PersistedMenuCategory) => ({
  ...category,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
});

const menuCategoryNameUniqueIndex = 'menu_categories_tenant_name_unique_idx';

const isMenuCategoryNameConflict = (error: unknown) =>
  isUniqueConstraintViolation(error, menuCategoryNameUniqueIndex);

export const listMenuCategories = async (
  tenantId: string
): Promise<ListMenuCategoriesResult> => {
  const categories = await db
    .select(menuCategorySelect)
    .from(menuCategories)
    .where(eq(menuCategories.tenantId, tenantId))
    .orderBy(asc(menuCategories.createdAt), asc(menuCategories.id));

  return {
    ok: true,
    data: {
      categories: categories.map(serializeMenuCategory),
    },
  };
};

export const createMenuCategory = async (
  tenantId: string,
  request: MenuCategoryRequest
): Promise<CreateMenuCategoryResult> => {
  const validation = parseMenuCategoryRequest(request);

  if (!validation.success) {
    return { ok: false, errorCode: 'INVALID_MENU_CATEGORY_REQUEST' };
  }

  const category = validation.data;

  try {
    const [createdCategory] = await db
      .insert(menuCategories)
      .values({
        id: randomUUID(),
        tenantId,
        name: category.name,
      })
      .returning(menuCategorySelect);

    if (!createdCategory) {
      return { ok: false, errorCode: 'MENU_CATEGORY_CREATE_FAILED' };
    }

    return {
      ok: true,
      data: {
        category: serializeMenuCategory(createdCategory),
      },
    };
  } catch (error) {
    if (isMenuCategoryNameConflict(error)) {
      return { ok: false, errorCode: 'MENU_CATEGORY_NAME_ALREADY_EXISTS' };
    }

    return { ok: false, errorCode: 'MENU_CATEGORY_CREATE_FAILED' };
  }
};

export const updateMenuCategory = async (
  tenantId: string,
  categoryId: string,
  request: MenuCategoryRequest
): Promise<UpdateMenuCategoryResult> => {
  const validation = parseMenuCategoryRequest(request);

  if (!validation.success) {
    return { ok: false, errorCode: 'INVALID_MENU_CATEGORY_REQUEST' };
  }

  const category = validation.data;

  try {
    const [updatedCategory] = await db
      .update(menuCategories)
      .set({
        name: category.name,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(menuCategories.tenantId, tenantId),
          eq(menuCategories.id, categoryId)
        )
      )
      .returning(menuCategorySelect);

    if (!updatedCategory) {
      return { ok: false, errorCode: 'MENU_CATEGORY_NOT_FOUND' };
    }

    return {
      ok: true,
      data: {
        category: serializeMenuCategory(updatedCategory),
      },
    };
  } catch (error) {
    if (isMenuCategoryNameConflict(error)) {
      return { ok: false, errorCode: 'MENU_CATEGORY_NAME_ALREADY_EXISTS' };
    }

    return { ok: false, errorCode: 'MENU_CATEGORY_UPDATE_FAILED' };
  }
};

export const deleteMenuCategory = async (
  tenantId: string,
  categoryId: string
): Promise<DeleteMenuCategoryResult> => {
  try {
    const [deletedCategory] = await db
      .delete(menuCategories)
      .where(
        and(
          eq(menuCategories.tenantId, tenantId),
          eq(menuCategories.id, categoryId)
        )
      )
      .returning({ id: menuCategories.id });

    if (!deletedCategory) {
      return { ok: false, errorCode: 'MENU_CATEGORY_NOT_FOUND' };
    }

    return { ok: true };
  } catch {
    return { ok: false, errorCode: 'MENU_CATEGORY_DELETE_FAILED' };
  }
};
