export type MenuCategory = {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type MenuCategoryRequest = {
  name?: unknown;
};

export type MenuCategoryResponse = {
  category: MenuCategory;
};

export type ListMenuCategoriesResponse = {
  categories: MenuCategory[];
};
