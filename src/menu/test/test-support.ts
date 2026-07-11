import { db } from '../../db/index.js';
import { menuCategories } from '../../db/schema.js';

type InsertMenuCategoryOptions = Partial<typeof menuCategories.$inferInsert>;

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
