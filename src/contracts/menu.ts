export type FixedPriceProduct = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  isAvailable: boolean;
  price: string;
  createdAt: string;
  updatedAt: string;
};

export type MenuCategory = {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  products: FixedPriceProduct[];
};

export type MenuCategoryRequest = {
  name?: unknown;
};

export type FixedPriceProductRequest = {
  name?: unknown;
  description?: unknown;
  isAvailable?: unknown;
  price?: unknown;
};

export type MenuCategoryResponse = {
  category: MenuCategory;
};

export type FixedPriceProductResponse = {
  product: FixedPriceProduct;
};

export type ListMenuCategoriesResponse = {
  categories: MenuCategory[];
};
