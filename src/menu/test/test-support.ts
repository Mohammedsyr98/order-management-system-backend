import { db } from '../../db/index.js';
import {
  menuAddOnGroups,
  menuAddOnItems,
  menuCategories,
  menuProductAddOnGroups,
  menuProductPricingChoices,
  menuProducts,
} from '../../db/schema.js';

type InsertMenuAddOnGroupOptions = Partial<typeof menuAddOnGroups.$inferInsert>;
type InsertMenuAddOnItemOptions = Partial<typeof menuAddOnItems.$inferInsert>;
type InsertMenuCategoryOptions = Partial<typeof menuCategories.$inferInsert>;
type InsertMenuProductOptions = Partial<typeof menuProducts.$inferInsert>;
type InsertMenuProductAddOnGroupOptions = Partial<
  typeof menuProductAddOnGroups.$inferInsert
>;
type InsertMenuProductPricingChoiceOptions = Partial<
  typeof menuProductPricingChoices.$inferInsert
>;

export const insertMenuAddOnGroup = async (
  options: InsertMenuAddOnGroupOptions = {}
) => {
  const group = {
    id: 'add-on-group-1',
    tenantId: 'tenant-1',
    name: 'Drinks',
    ...options,
  } satisfies typeof menuAddOnGroups.$inferInsert;

  await db.insert(menuAddOnGroups).values(group);

  return group;
};

export const insertMenuAddOnItem = async (
  options: InsertMenuAddOnItemOptions = {}
) => {
  const item = {
    id: 'add-on-item-1',
    groupId: 'add-on-group-1',
    name: 'Ayran',
    isAvailable: true,
    priceMinorUnits: 3000,
    ...options,
  } satisfies typeof menuAddOnItems.$inferInsert;

  await db.insert(menuAddOnItems).values(item);

  return item;
};

export const insertMenuCategory = async (
  options: InsertMenuCategoryOptions = {}
) => {
  const category = {
    id: 'category-1',
    tenantId: 'tenant-1',
    name: 'Mains',
    ...options,
  } satisfies typeof menuCategories.$inferInsert;

  await db.insert(menuCategories).values(category);

  return category;
};

export const insertMenuProduct = async (
  options: InsertMenuProductOptions = {}
) => {
  const product = {
    id: 'product-1',
    categoryId: 'category-1',
    name: 'Ayran',
    description: null,
    isAvailable: true,
    priceMinorUnits: 3000,
    ...options,
  } satisfies typeof menuProducts.$inferInsert;

  await db.insert(menuProducts).values(product);

  return product;
};

export const insertMenuProductAddOnGroup = async (
  options: InsertMenuProductAddOnGroupOptions = {}
) => {
  const attachment = {
    productId: 'product-1',
    addOnGroupId: 'add-on-group-1',
    ...options,
  } satisfies typeof menuProductAddOnGroups.$inferInsert;

  await db.insert(menuProductAddOnGroups).values(attachment);

  return attachment;
};

export const insertMenuProductPricingChoice = async (
  options: InsertMenuProductPricingChoiceOptions = {}
) => {
  const choice = {
    id: 'choice-1',
    productId: 'product-1',
    name: 'Regular',
    isAvailable: true,
    priceMinorUnits: 3000,
    ...options,
  } satisfies typeof menuProductPricingChoices.$inferInsert;

  await db.insert(menuProductPricingChoices).values(choice);

  return choice;
};
