import { randomUUID } from 'node:crypto';

import { and, asc, eq, inArray } from 'drizzle-orm';

import type {
  FixedPriceProductRequest,
  MenuCategoryRequest,
} from '../contracts/menu.js';
import { isUniqueConstraintViolation } from '../db/db-errors.js';
import { db } from '../db/index.js';
import { menuCategories, menuProducts } from '../db/schema.js';
import type {
  CreateFixedPriceProductResult,
  CreateMenuCategoryResult,
  DeleteFixedPriceProductResult,
  DeleteMenuCategoryResult,
  ListMenuCategoriesResult,
  UpdateFixedPriceProductResult,
  UpdateMenuCategoryResult,
} from './menu-types.js';
import {
  formatMinorUnitsPrice,
  parseFixedPriceProductCreateRequest,
  parseFixedPriceProductUpdateRequest,
  parseMenuCategoryRequest,
} from './menu-validation.js';

type PersistedMenuCategory = typeof menuCategories.$inferSelect;
type PersistedMenuProduct = typeof menuProducts.$inferSelect;

const menuCategorySelect = {
  id: menuCategories.id,
  tenantId: menuCategories.tenantId,
  name: menuCategories.name,
  createdAt: menuCategories.createdAt,
  updatedAt: menuCategories.updatedAt,
};

const menuProductSelect = {
  id: menuProducts.id,
  categoryId: menuProducts.categoryId,
  name: menuProducts.name,
  description: menuProducts.description,
  isAvailable: menuProducts.isAvailable,
  priceMinorUnits: menuProducts.priceMinorUnits,
  createdAt: menuProducts.createdAt,
  updatedAt: menuProducts.updatedAt,
};

const serializeFixedPriceProduct = (product: PersistedMenuProduct) => ({
  id: product.id,
  categoryId: product.categoryId,
  name: product.name,
  description: product.description,
  isAvailable: product.isAvailable,
  price: formatMinorUnitsPrice(product.priceMinorUnits),
  createdAt: product.createdAt.toISOString(),
  updatedAt: product.updatedAt.toISOString(),
});

const serializeMenuCategory = (
  category: PersistedMenuCategory,
  products: PersistedMenuProduct[] = []
) => ({
  ...category,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
  products: products.map(serializeFixedPriceProduct),
});

const menuCategoryNameUniqueIndex = 'menu_categories_tenant_name_unique_idx';
const menuProductNameUniqueIndex = 'menu_products_category_name_unique_idx';

const isMenuCategoryNameConflict = (error: unknown) =>
  isUniqueConstraintViolation(error, menuCategoryNameUniqueIndex);

const isMenuProductNameConflict = (error: unknown) =>
  isUniqueConstraintViolation(error, menuProductNameUniqueIndex);

const findTenantCategory = async (tenantId: string, categoryId: string) => {
  const [category] = await db
    .select({ id: menuCategories.id })
    .from(menuCategories)
    .where(
      and(
        eq(menuCategories.tenantId, tenantId),
        eq(menuCategories.id, categoryId)
      )
    );

  return category;
};

const findTenantProduct = async (tenantId: string, productId: string) => {
  const [product] = await db
    .select({ id: menuProducts.id })
    .from(menuProducts)
    .innerJoin(menuCategories, eq(menuCategories.id, menuProducts.categoryId))
    .where(
      and(eq(menuCategories.tenantId, tenantId), eq(menuProducts.id, productId))
    );

  return product;
};

export const listMenuCategories = async (
  tenantId: string
): Promise<ListMenuCategoriesResult> => {
  const categories = await db
    .select(menuCategorySelect)
    .from(menuCategories)
    .where(eq(menuCategories.tenantId, tenantId))
    .orderBy(asc(menuCategories.createdAt), asc(menuCategories.id));

  const categoryIds = categories.map((category) => category.id);
  const products =
    categoryIds.length === 0
      ? []
      : await db
          .select(menuProductSelect)
          .from(menuProducts)
          .where(inArray(menuProducts.categoryId, categoryIds))
          .orderBy(asc(menuProducts.createdAt), asc(menuProducts.id));

  const productsByCategory = new Map<string, PersistedMenuProduct[]>();

  for (const product of products) {
    const categoryProducts = productsByCategory.get(product.categoryId) ?? [];
    categoryProducts.push(product);
    productsByCategory.set(product.categoryId, categoryProducts);
  }

  return {
    ok: true,
    data: {
      categories: categories.map((category) =>
        serializeMenuCategory(category, productsByCategory.get(category.id))
      ),
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

export const createFixedPriceProduct = async (
  tenantId: string,
  categoryId: string,
  request: FixedPriceProductRequest
): Promise<CreateFixedPriceProductResult> => {
  const validation = parseFixedPriceProductCreateRequest(request);

  if (!validation.success) {
    return { ok: false, errorCode: 'INVALID_MENU_PRODUCT_REQUEST' };
  }

  const category = await findTenantCategory(tenantId, categoryId);

  if (!category) {
    return { ok: false, errorCode: 'MENU_CATEGORY_NOT_FOUND' };
  }

  const product = validation.data;

  try {
    const [createdProduct] = await db
      .insert(menuProducts)
      .values({
        id: randomUUID(),
        categoryId,
        name: product.name,
        description: product.description,
        isAvailable: product.isAvailable,
        priceMinorUnits: product.priceMinorUnits,
      })
      .returning(menuProductSelect);

    if (!createdProduct) {
      return { ok: false, errorCode: 'MENU_PRODUCT_CREATE_FAILED' };
    }

    return {
      ok: true,
      data: {
        product: serializeFixedPriceProduct(createdProduct),
      },
    };
  } catch (error) {
    if (isMenuProductNameConflict(error)) {
      return { ok: false, errorCode: 'MENU_PRODUCT_NAME_ALREADY_EXISTS' };
    }

    return { ok: false, errorCode: 'MENU_PRODUCT_CREATE_FAILED' };
  }
};

export const updateFixedPriceProduct = async (
  tenantId: string,
  productId: string,
  request: FixedPriceProductRequest
): Promise<UpdateFixedPriceProductResult> => {
  const validation = parseFixedPriceProductUpdateRequest(request);

  if (!validation.success) {
    return { ok: false, errorCode: 'INVALID_MENU_PRODUCT_REQUEST' };
  }

  const existingProduct = await findTenantProduct(tenantId, productId);

  if (!existingProduct) {
    return { ok: false, errorCode: 'MENU_PRODUCT_NOT_FOUND' };
  }

  const product = validation.data;

  try {
    const [updatedProduct] = await db
      .update(menuProducts)
      .set({
        name: product.name,
        description: product.description,
        isAvailable: product.isAvailable,
        priceMinorUnits: product.priceMinorUnits,
        updatedAt: new Date(),
      })
      .where(eq(menuProducts.id, existingProduct.id))
      .returning(menuProductSelect);

    if (!updatedProduct) {
      return { ok: false, errorCode: 'MENU_PRODUCT_NOT_FOUND' };
    }

    return {
      ok: true,
      data: {
        product: serializeFixedPriceProduct(updatedProduct),
      },
    };
  } catch (error) {
    if (isMenuProductNameConflict(error)) {
      return { ok: false, errorCode: 'MENU_PRODUCT_NAME_ALREADY_EXISTS' };
    }

    return { ok: false, errorCode: 'MENU_PRODUCT_UPDATE_FAILED' };
  }
};

export const deleteFixedPriceProduct = async (
  tenantId: string,
  productId: string
): Promise<DeleteFixedPriceProductResult> => {
  const existingProduct = await findTenantProduct(tenantId, productId);

  if (!existingProduct) {
    return { ok: false, errorCode: 'MENU_PRODUCT_NOT_FOUND' };
  }

  try {
    const [deletedProduct] = await db
      .delete(menuProducts)
      .where(eq(menuProducts.id, existingProduct.id))
      .returning({ id: menuProducts.id });

    if (!deletedProduct) {
      return { ok: false, errorCode: 'MENU_PRODUCT_NOT_FOUND' };
    }

    return { ok: true };
  } catch {
    return { ok: false, errorCode: 'MENU_PRODUCT_DELETE_FAILED' };
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
