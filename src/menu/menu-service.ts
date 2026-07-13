import { randomUUID } from 'node:crypto';

import { and, asc, eq, inArray } from 'drizzle-orm';

import type {
  FixedPriceProductRequest,
  MenuAddOnGroup,
  MenuAddOnGroupRequest,
  MenuProductRequest,
  MenuCategoryRequest,
} from '../contracts/menu.js';
import { isUniqueConstraintViolation } from '../db/db-errors.js';
import { db } from '../db/index.js';
import {
  menuAddOnGroups,
  menuAddOnItems,
  menuCategories,
  menuProductAddOnGroups,
  menuProductPricingChoices,
  menuProducts,
} from '../db/schema.js';
import type {
  CreateMenuAddOnGroupResult,
  CreateFixedPriceProductResult,
  CreateMenuProductResult,
  CreateMenuCategoryResult,
  DeleteMenuAddOnGroupResult,
  DeleteFixedPriceProductResult,
  DeleteMenuProductResult,
  DeleteMenuCategoryResult,
  ListMenuAddOnGroupsResult,
  ListMenuCategoriesResult,
  UpdateMenuAddOnGroupResult,
  UpdateFixedPriceProductResult,
  UpdateMenuProductResult,
  UpdateMenuCategoryResult,
} from './menu-types.js';
import {
  formatMinorUnitsPrice,
  parseAddOnGroupCreateRequest,
  parseAddOnGroupUpdateRequest,
  parseChoicePricedProductCreateRequest,
  parseChoicePricedProductUpdateRequest,
  parseFixedPriceProductCreateRequest,
  parseFixedPriceProductUpdateRequest,
  parseMenuCategoryRequest,
} from './menu-validation.js';

type PersistedMenuCategory = typeof menuCategories.$inferSelect;
type PersistedMenuProduct = typeof menuProducts.$inferSelect;
type PersistedPricingChoice = typeof menuProductPricingChoices.$inferSelect;
type PersistedAddOnGroup = typeof menuAddOnGroups.$inferSelect;
type PersistedAddOnItem = typeof menuAddOnItems.$inferSelect;

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
  pricingMode: menuProducts.pricingMode,
  priceMinorUnits: menuProducts.priceMinorUnits,
  createdAt: menuProducts.createdAt,
  updatedAt: menuProducts.updatedAt,
};

const menuProductPricingChoiceSelect = {
  id: menuProductPricingChoices.id,
  productId: menuProductPricingChoices.productId,
  name: menuProductPricingChoices.name,
  isAvailable: menuProductPricingChoices.isAvailable,
  priceMinorUnits: menuProductPricingChoices.priceMinorUnits,
  createdAt: menuProductPricingChoices.createdAt,
  updatedAt: menuProductPricingChoices.updatedAt,
};

const menuAddOnGroupSelect = {
  id: menuAddOnGroups.id,
  tenantId: menuAddOnGroups.tenantId,
  name: menuAddOnGroups.name,
  createdAt: menuAddOnGroups.createdAt,
  updatedAt: menuAddOnGroups.updatedAt,
};

const menuAddOnItemSelect = {
  id: menuAddOnItems.id,
  groupId: menuAddOnItems.groupId,
  name: menuAddOnItems.name,
  isAvailable: menuAddOnItems.isAvailable,
  priceMinorUnits: menuAddOnItems.priceMinorUnits,
  createdAt: menuAddOnItems.createdAt,
  updatedAt: menuAddOnItems.updatedAt,
};

const serializeFixedPriceProduct = (
  product: PersistedMenuProduct,
  addOnGroups: MenuAddOnGroup[] = []
) => ({
  id: product.id,
  categoryId: product.categoryId,
  name: product.name,
  description: product.description,
  isAvailable: product.isAvailable,
  pricingMode: 'fixed' as const,
  pricing: {
    price: formatMinorUnitsPrice(product.priceMinorUnits ?? 0),
  },
  addOnGroups,
  createdAt: product.createdAt.toISOString(),
  updatedAt: product.updatedAt.toISOString(),
});

const serializePricingChoice = (choice: PersistedPricingChoice) => ({
  id: choice.id,
  name: choice.name,
  isAvailable: choice.isAvailable,
  price: formatMinorUnitsPrice(choice.priceMinorUnits),
  createdAt: choice.createdAt.toISOString(),
  updatedAt: choice.updatedAt.toISOString(),
});

const serializeMenuProduct = (
  product: PersistedMenuProduct,
  choices: PersistedPricingChoice[] = [],
  addOnGroups: MenuAddOnGroup[] = []
) => {
  if (product.pricingMode === 'priced_by_choice') {
    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      isAvailable: product.isAvailable,
      pricingMode: product.pricingMode,
      pricing: {
        choices: choices.map(serializePricingChoice),
      },
      addOnGroups,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  return serializeFixedPriceProduct(product, addOnGroups);
};

const serializeMenuCategory = (
  category: PersistedMenuCategory,
  products: PersistedMenuProduct[] = [],
  choicesByProduct: Map<string, PersistedPricingChoice[]> = new Map(),
  addOnGroupsByProduct: Map<string, MenuAddOnGroup[]> = new Map()
) => ({
  ...category,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
  products: products.map((product) =>
    serializeMenuProduct(
      product,
      choicesByProduct.get(product.id),
      addOnGroupsByProduct.get(product.id)
    )
  ),
});

const serializeAddOnItem = (item: PersistedAddOnItem) => ({
  id: item.id,
  groupId: item.groupId,
  name: item.name,
  price: formatMinorUnitsPrice(item.priceMinorUnits),
  isAvailable: item.isAvailable,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

const serializeAddOnGroup = (
  group: PersistedAddOnGroup,
  items: PersistedAddOnItem[] = []
) => ({
  ...group,
  createdAt: group.createdAt.toISOString(),
  updatedAt: group.updatedAt.toISOString(),
  items: items.map(serializeAddOnItem),
});

const loadTenantAddOnGroups = async (
  tenantId: string,
  groupIds: string[]
): Promise<MenuAddOnGroup[]> => {
  if (groupIds.length === 0) {
    return [];
  }

  const groups = await db
    .select(menuAddOnGroupSelect)
    .from(menuAddOnGroups)
    .where(
      and(
        eq(menuAddOnGroups.tenantId, tenantId),
        inArray(menuAddOnGroups.id, groupIds)
      )
    )
    .orderBy(asc(menuAddOnGroups.createdAt), asc(menuAddOnGroups.id));
  const items = await db
    .select(menuAddOnItemSelect)
    .from(menuAddOnItems)
    .where(
      inArray(
        menuAddOnItems.groupId,
        groups.map((group) => group.id)
      )
    )
    .orderBy(asc(menuAddOnItems.createdAt), asc(menuAddOnItems.id));
  const itemsByGroup = new Map<string, PersistedAddOnItem[]>();

  for (const item of items) {
    const groupItems = itemsByGroup.get(item.groupId) ?? [];
    groupItems.push(item);
    itemsByGroup.set(item.groupId, groupItems);
  }

  return groups.map((group) =>
    serializeAddOnGroup(group, itemsByGroup.get(group.id))
  );
};

type PricingChoiceInput = {
  name: string;
  isAvailable: boolean;
  priceMinorUnits: number;
};

type AddOnItemInput = {
  name: string;
  isAvailable: boolean;
  priceMinorUnits: number;
};

const productPricingChoiceRows = (
  productId: string,
  choices: PricingChoiceInput[]
) => {
  const choiceCreatedAt = new Date();

  return choices.map((choice, index) => {
    const createdAt = new Date(choiceCreatedAt.getTime() + index);

    return {
      id: randomUUID(),
      productId,
      name: choice.name,
      isAvailable: choice.isAvailable,
      priceMinorUnits: choice.priceMinorUnits,
      createdAt,
      updatedAt: createdAt,
    };
  });
};

const productAddOnGroupRows = (productId: string, addOnGroupIds: string[]) =>
  addOnGroupIds.map((addOnGroupId) => ({
    productId,
    addOnGroupId,
  }));

const addOnItemRows = (groupId: string, items: AddOnItemInput[]) => {
  const itemCreatedAt = new Date();

  return items.map((item, index) => {
    const createdAt = new Date(itemCreatedAt.getTime() + index);

    return {
      id: randomUUID(),
      groupId,
      name: item.name,
      isAvailable: item.isAvailable,
      priceMinorUnits: item.priceMinorUnits,
      createdAt,
      updatedAt: createdAt,
    };
  });
};

const menuCategoryNameUniqueIndex = 'menu_categories_tenant_name_unique_idx';
const menuProductNameUniqueIndex = 'menu_products_category_name_unique_idx';
const menuAddOnGroupNameUniqueIndex =
  'menu_add_on_groups_tenant_name_unique_idx';

const isMenuCategoryNameConflict = (error: unknown) =>
  isUniqueConstraintViolation(error, menuCategoryNameUniqueIndex);

const isMenuProductNameConflict = (error: unknown) =>
  isUniqueConstraintViolation(error, menuProductNameUniqueIndex);

const isMenuAddOnGroupNameConflict = (error: unknown) =>
  isUniqueConstraintViolation(error, menuAddOnGroupNameUniqueIndex);

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

const findTenantAddOnGroup = async (tenantId: string, groupId: string) => {
  const [group] = await db
    .select({ id: menuAddOnGroups.id })
    .from(menuAddOnGroups)
    .where(
      and(
        eq(menuAddOnGroups.tenantId, tenantId),
        eq(menuAddOnGroups.id, groupId)
      )
    );

  return group;
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
  const productIds = products.map((product) => product.id);
  const choices =
    productIds.length === 0
      ? []
      : await db
          .select(menuProductPricingChoiceSelect)
          .from(menuProductPricingChoices)
          .where(inArray(menuProductPricingChoices.productId, productIds))
          .orderBy(
            asc(menuProductPricingChoices.createdAt),
            asc(menuProductPricingChoices.id)
          );
  const choicesByProduct = new Map<string, PersistedPricingChoice[]>();
  const attachedGroups =
    productIds.length === 0
      ? []
      : await db
          .select({
            productId: menuProductAddOnGroups.productId,
            group: menuAddOnGroupSelect,
          })
          .from(menuProductAddOnGroups)
          .innerJoin(
            menuAddOnGroups,
            eq(menuAddOnGroups.id, menuProductAddOnGroups.addOnGroupId)
          )
          .where(
            and(
              inArray(menuProductAddOnGroups.productId, productIds),
              eq(menuAddOnGroups.tenantId, tenantId)
            )
          )
          .orderBy(asc(menuAddOnGroups.createdAt), asc(menuAddOnGroups.id));
  const attachedGroupIds = [
    ...new Set(attachedGroups.map(({ group }) => group.id)),
  ];
  const attachedItems =
    attachedGroupIds.length === 0
      ? []
      : await db
          .select(menuAddOnItemSelect)
          .from(menuAddOnItems)
          .where(inArray(menuAddOnItems.groupId, attachedGroupIds))
          .orderBy(asc(menuAddOnItems.createdAt), asc(menuAddOnItems.id));
  const attachedItemsByGroup = new Map<string, PersistedAddOnItem[]>();
  const addOnGroupsByProduct = new Map<string, MenuAddOnGroup[]>();

  for (const product of products) {
    const categoryProducts = productsByCategory.get(product.categoryId) ?? [];
    categoryProducts.push(product);
    productsByCategory.set(product.categoryId, categoryProducts);
  }

  for (const choice of choices) {
    const productChoices = choicesByProduct.get(choice.productId) ?? [];
    productChoices.push(choice);
    choicesByProduct.set(choice.productId, productChoices);
  }

  for (const item of attachedItems) {
    const groupItems = attachedItemsByGroup.get(item.groupId) ?? [];
    groupItems.push(item);
    attachedItemsByGroup.set(item.groupId, groupItems);
  }

  for (const { productId, group } of attachedGroups) {
    const productGroups = addOnGroupsByProduct.get(productId) ?? [];
    productGroups.push(
      serializeAddOnGroup(group, attachedItemsByGroup.get(group.id))
    );
    addOnGroupsByProduct.set(productId, productGroups);
  }

  return {
    ok: true,
    data: {
      categories: categories.map((category) =>
        serializeMenuCategory(
          category,
          productsByCategory.get(category.id),
          choicesByProduct,
          addOnGroupsByProduct
        )
      ),
    },
  };
};

export const listMenuAddOnGroups = async (
  tenantId: string
): Promise<ListMenuAddOnGroupsResult> => {
  const groups = await db
    .select(menuAddOnGroupSelect)
    .from(menuAddOnGroups)
    .where(eq(menuAddOnGroups.tenantId, tenantId))
    .orderBy(asc(menuAddOnGroups.createdAt), asc(menuAddOnGroups.id));

  const groupIds = groups.map((group) => group.id);
  const items =
    groupIds.length === 0
      ? []
      : await db
          .select(menuAddOnItemSelect)
          .from(menuAddOnItems)
          .where(inArray(menuAddOnItems.groupId, groupIds))
          .orderBy(asc(menuAddOnItems.createdAt), asc(menuAddOnItems.id));

  const itemsByGroup = new Map<string, PersistedAddOnItem[]>();

  for (const item of items) {
    const groupItems = itemsByGroup.get(item.groupId) ?? [];
    groupItems.push(item);
    itemsByGroup.set(item.groupId, groupItems);
  }

  return {
    ok: true,
    data: {
      addOnGroups: groups.map((group) =>
        serializeAddOnGroup(group, itemsByGroup.get(group.id))
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

export const createMenuAddOnGroup = async (
  tenantId: string,
  request: MenuAddOnGroupRequest
): Promise<CreateMenuAddOnGroupResult> => {
  const validation = parseAddOnGroupCreateRequest(request);

  if (!validation.success) {
    return { ok: false, errorCode: 'INVALID_MENU_ADD_ON_GROUP_REQUEST' };
  }

  const group = validation.data;
  const groupId = randomUUID();

  try {
    const [createdGroups, createdItems] = await db.batch([
      db
        .insert(menuAddOnGroups)
        .values({
          id: groupId,
          tenantId,
          name: group.name,
        })
        .returning(menuAddOnGroupSelect),
      db
        .insert(menuAddOnItems)
        .values(addOnItemRows(groupId, group.items))
        .returning(menuAddOnItemSelect),
    ]);
    const createdGroup = createdGroups[0];

    if (!createdGroup || createdItems.length !== group.items.length) {
      return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_CREATE_FAILED' };
    }

    return {
      ok: true,
      data: {
        addOnGroup: serializeAddOnGroup(createdGroup, createdItems),
      },
    };
  } catch (error) {
    if (isMenuAddOnGroupNameConflict(error)) {
      return {
        ok: false,
        errorCode: 'MENU_ADD_ON_GROUP_NAME_ALREADY_EXISTS',
      };
    }

    return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_CREATE_FAILED' };
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
  const addOnGroups = await loadTenantAddOnGroups(
    tenantId,
    product.addOnGroupIds
  );

  if (addOnGroups.length !== product.addOnGroupIds.length) {
    return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND' };
  }

  const productId = randomUUID();

  try {
    const createProductQuery = db
      .insert(menuProducts)
      .values({
        id: productId,
        categoryId,
        name: product.name,
        description: product.description,
        isAvailable: product.isAvailable,
        priceMinorUnits: product.priceMinorUnits,
      })
      .returning(menuProductSelect);
    let createdProduct: PersistedMenuProduct | undefined;

    if (product.addOnGroupIds.length === 0) {
      [createdProduct] = await createProductQuery;
    } else {
      const [createdProducts, createdAttachments] = await db.batch([
        createProductQuery,
        db
          .insert(menuProductAddOnGroups)
          .values(productAddOnGroupRows(productId, product.addOnGroupIds))
          .returning({ addOnGroupId: menuProductAddOnGroups.addOnGroupId }),
      ]);
      [createdProduct] = createdProducts;

      if (createdAttachments.length !== product.addOnGroupIds.length) {
        return { ok: false, errorCode: 'MENU_PRODUCT_CREATE_FAILED' };
      }
    }

    if (!createdProduct) {
      return { ok: false, errorCode: 'MENU_PRODUCT_CREATE_FAILED' };
    }

    return {
      ok: true,
      data: {
        product: serializeFixedPriceProduct(createdProduct, addOnGroups),
      },
    };
  } catch (error) {
    if (isMenuProductNameConflict(error)) {
      return { ok: false, errorCode: 'MENU_PRODUCT_NAME_ALREADY_EXISTS' };
    }

    return { ok: false, errorCode: 'MENU_PRODUCT_CREATE_FAILED' };
  }
};

export const createMenuProduct = async (
  tenantId: string,
  categoryId: string,
  request: MenuProductRequest
): Promise<CreateMenuProductResult> => {
  const choiceValidation = parseChoicePricedProductCreateRequest(request);

  if (!choiceValidation.success) {
    const fixedValidation = parseFixedPriceProductCreateRequest(request);

    if (fixedValidation.success) {
      return createFixedPriceProduct(tenantId, categoryId, request);
    }

    return { ok: false, errorCode: 'INVALID_MENU_PRODUCT_REQUEST' };
  }

  const category = await findTenantCategory(tenantId, categoryId);

  if (!category) {
    return { ok: false, errorCode: 'MENU_CATEGORY_NOT_FOUND' };
  }

  const product = choiceValidation.data;
  const addOnGroups = await loadTenantAddOnGroups(
    tenantId,
    product.addOnGroupIds
  );

  if (addOnGroups.length !== product.addOnGroupIds.length) {
    return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND' };
  }

  const productId = randomUUID();

  try {
    const createProductQuery = db
      .insert(menuProducts)
      .values({
        id: productId,
        categoryId,
        name: product.name,
        description: product.description,
        isAvailable: product.isAvailable,
        pricingMode: product.pricingMode,
        priceMinorUnits: null,
      })
      .returning(menuProductSelect);
    const createChoicesQuery = db
      .insert(menuProductPricingChoices)
      .values(productPricingChoiceRows(productId, product.choices))
      .returning(menuProductPricingChoiceSelect);
    let createdProduct: PersistedMenuProduct | undefined;
    let createdChoices: PersistedPricingChoice[];

    if (product.addOnGroupIds.length === 0) {
      const [createdProducts, choices] = await db.batch([
        createProductQuery,
        createChoicesQuery,
      ]);
      [createdProduct] = createdProducts;
      createdChoices = choices;
    } else {
      const [createdProducts, choices, createdAttachments] = await db.batch([
        createProductQuery,
        createChoicesQuery,
        db
          .insert(menuProductAddOnGroups)
          .values(productAddOnGroupRows(productId, product.addOnGroupIds))
          .returning({ addOnGroupId: menuProductAddOnGroups.addOnGroupId }),
      ]);
      [createdProduct] = createdProducts;
      createdChoices = choices;

      if (createdAttachments.length !== product.addOnGroupIds.length) {
        return { ok: false, errorCode: 'MENU_PRODUCT_CREATE_FAILED' };
      }
    }

    if (!createdProduct || createdChoices.length !== product.choices.length) {
      return { ok: false, errorCode: 'MENU_PRODUCT_CREATE_FAILED' };
    }

    return {
      ok: true,
      data: {
        product: serializeMenuProduct(
          createdProduct,
          createdChoices,
          addOnGroups
        ),
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
  const addOnGroups = await loadTenantAddOnGroups(
    tenantId,
    product.addOnGroupIds
  );

  if (addOnGroups.length !== product.addOnGroupIds.length) {
    return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND' };
  }

  try {
    const updateProductQuery = db
      .update(menuProducts)
      .set({
        name: product.name,
        description: product.description,
        isAvailable: product.isAvailable,
        pricingMode: product.pricingMode,
        priceMinorUnits: product.priceMinorUnits,
        updatedAt: new Date(),
      })
      .where(eq(menuProducts.id, existingProduct.id))
      .returning(menuProductSelect);
    const deleteChoicesQuery = db
      .delete(menuProductPricingChoices)
      .where(eq(menuProductPricingChoices.productId, existingProduct.id));
    const deleteAttachmentsQuery = db
      .delete(menuProductAddOnGroups)
      .where(eq(menuProductAddOnGroups.productId, existingProduct.id));
    let updatedProduct: PersistedMenuProduct | undefined;

    if (product.addOnGroupIds.length === 0) {
      const [updatedProducts] = await db.batch([
        updateProductQuery,
        deleteChoicesQuery,
        deleteAttachmentsQuery,
      ]);
      [updatedProduct] = updatedProducts;
    } else {
      const [updatedProducts, , , createdAttachments] = await db.batch([
        updateProductQuery,
        deleteChoicesQuery,
        deleteAttachmentsQuery,
        db
          .insert(menuProductAddOnGroups)
          .values(
            productAddOnGroupRows(existingProduct.id, product.addOnGroupIds)
          )
          .returning({ addOnGroupId: menuProductAddOnGroups.addOnGroupId }),
      ]);
      [updatedProduct] = updatedProducts;

      if (createdAttachments.length !== product.addOnGroupIds.length) {
        return { ok: false, errorCode: 'MENU_PRODUCT_UPDATE_FAILED' };
      }
    }

    if (!updatedProduct) {
      return { ok: false, errorCode: 'MENU_PRODUCT_NOT_FOUND' };
    }

    return {
      ok: true,
      data: {
        product: serializeMenuProduct(updatedProduct, [], addOnGroups),
      },
    };
  } catch (error) {
    if (isMenuProductNameConflict(error)) {
      return { ok: false, errorCode: 'MENU_PRODUCT_NAME_ALREADY_EXISTS' };
    }

    return { ok: false, errorCode: 'MENU_PRODUCT_UPDATE_FAILED' };
  }
};

export const updateMenuProduct = async (
  tenantId: string,
  productId: string,
  request: MenuProductRequest
): Promise<UpdateMenuProductResult> => {
  const choiceValidation = parseChoicePricedProductUpdateRequest(request);

  if (!choiceValidation.success) {
    const fixedValidation = parseFixedPriceProductUpdateRequest(request);

    if (fixedValidation.success) {
      return updateFixedPriceProduct(tenantId, productId, request);
    }

    return { ok: false, errorCode: 'INVALID_MENU_PRODUCT_REQUEST' };
  }

  const existingProduct = await findTenantProduct(tenantId, productId);

  if (!existingProduct) {
    return { ok: false, errorCode: 'MENU_PRODUCT_NOT_FOUND' };
  }

  const product = choiceValidation.data;
  const addOnGroups = await loadTenantAddOnGroups(
    tenantId,
    product.addOnGroupIds
  );

  if (addOnGroups.length !== product.addOnGroupIds.length) {
    return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND' };
  }

  try {
    const updateProductQuery = db
      .update(menuProducts)
      .set({
        name: product.name,
        description: product.description,
        isAvailable: product.isAvailable,
        pricingMode: product.pricingMode,
        priceMinorUnits: null,
        updatedAt: new Date(),
      })
      .where(eq(menuProducts.id, existingProduct.id))
      .returning(menuProductSelect);
    const deleteChoicesQuery = db
      .delete(menuProductPricingChoices)
      .where(eq(menuProductPricingChoices.productId, existingProduct.id));
    const createChoicesQuery = db
      .insert(menuProductPricingChoices)
      .values(productPricingChoiceRows(existingProduct.id, product.choices))
      .returning(menuProductPricingChoiceSelect);
    const deleteAttachmentsQuery = db
      .delete(menuProductAddOnGroups)
      .where(eq(menuProductAddOnGroups.productId, existingProduct.id));
    let updatedProduct: PersistedMenuProduct | undefined;
    let createdChoices: PersistedPricingChoice[];

    if (product.addOnGroupIds.length === 0) {
      const [updatedProducts, , choices] = await db.batch([
        updateProductQuery,
        deleteChoicesQuery,
        createChoicesQuery,
        deleteAttachmentsQuery,
      ]);
      [updatedProduct] = updatedProducts;
      createdChoices = choices;
    } else {
      const [updatedProducts, , choices, , createdAttachments] = await db.batch(
        [
          updateProductQuery,
          deleteChoicesQuery,
          createChoicesQuery,
          deleteAttachmentsQuery,
          db
            .insert(menuProductAddOnGroups)
            .values(
              productAddOnGroupRows(existingProduct.id, product.addOnGroupIds)
            )
            .returning({ addOnGroupId: menuProductAddOnGroups.addOnGroupId }),
        ]
      );
      [updatedProduct] = updatedProducts;
      createdChoices = choices;

      if (createdAttachments.length !== product.addOnGroupIds.length) {
        return { ok: false, errorCode: 'MENU_PRODUCT_UPDATE_FAILED' };
      }
    }

    if (!updatedProduct) {
      return { ok: false, errorCode: 'MENU_PRODUCT_NOT_FOUND' };
    }

    if (createdChoices.length !== product.choices.length) {
      return { ok: false, errorCode: 'MENU_PRODUCT_UPDATE_FAILED' };
    }

    return {
      ok: true,
      data: {
        product: serializeMenuProduct(
          updatedProduct,
          createdChoices,
          addOnGroups
        ),
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

export const deleteMenuProduct = async (
  tenantId: string,
  productId: string
): Promise<DeleteMenuProductResult> =>
  deleteFixedPriceProduct(tenantId, productId);

export const updateMenuAddOnGroup = async (
  tenantId: string,
  groupId: string,
  request: MenuAddOnGroupRequest
): Promise<UpdateMenuAddOnGroupResult> => {
  const validation = parseAddOnGroupUpdateRequest(request);

  if (!validation.success) {
    return { ok: false, errorCode: 'INVALID_MENU_ADD_ON_GROUP_REQUEST' };
  }

  const existingGroup = await findTenantAddOnGroup(tenantId, groupId);

  if (!existingGroup) {
    return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND' };
  }

  const group = validation.data;

  try {
    const [updatedGroups, , createdItems] = await db.batch([
      db
        .update(menuAddOnGroups)
        .set({
          name: group.name,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(menuAddOnGroups.tenantId, tenantId),
            eq(menuAddOnGroups.id, existingGroup.id)
          )
        )
        .returning(menuAddOnGroupSelect),
      db
        .delete(menuAddOnItems)
        .where(eq(menuAddOnItems.groupId, existingGroup.id)),
      db
        .insert(menuAddOnItems)
        .values(addOnItemRows(existingGroup.id, group.items))
        .returning(menuAddOnItemSelect),
    ]);
    const updatedGroup = updatedGroups[0];

    if (!updatedGroup) {
      return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND' };
    }

    if (createdItems.length !== group.items.length) {
      return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_UPDATE_FAILED' };
    }

    return {
      ok: true,
      data: {
        addOnGroup: serializeAddOnGroup(updatedGroup, createdItems),
      },
    };
  } catch (error) {
    if (isMenuAddOnGroupNameConflict(error)) {
      return {
        ok: false,
        errorCode: 'MENU_ADD_ON_GROUP_NAME_ALREADY_EXISTS',
      };
    }

    return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_UPDATE_FAILED' };
  }
};

export const deleteMenuAddOnGroup = async (
  tenantId: string,
  groupId: string
): Promise<DeleteMenuAddOnGroupResult> => {
  try {
    const [deletedGroup] = await db
      .delete(menuAddOnGroups)
      .where(
        and(
          eq(menuAddOnGroups.tenantId, tenantId),
          eq(menuAddOnGroups.id, groupId)
        )
      )
      .returning({ id: menuAddOnGroups.id });

    if (!deletedGroup) {
      return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND' };
    }

    return { ok: true };
  } catch {
    return { ok: false, errorCode: 'MENU_ADD_ON_GROUP_DELETE_FAILED' };
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
