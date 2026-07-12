import { db } from '../../db/index.js';
import {
  menuCategories,
  menuProductPricingChoices,
  menuProducts,
} from '../../db/schema.js';

type InsertMenuCategoryOptions = Partial<typeof menuCategories.$inferInsert>;
type InsertMenuProductOptions = Partial<typeof menuProducts.$inferInsert>;
type InsertMenuProductPricingChoiceOptions = Partial<
  typeof menuProductPricingChoices.$inferInsert
>;

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
