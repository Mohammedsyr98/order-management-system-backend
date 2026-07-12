export type ProductPricingMode = 'fixed' | 'priced_by_choice';

export type MenuProductBase = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FixedPriceProduct = MenuProductBase & {
  pricingMode: 'fixed';
  pricing: {
    price: string;
  };
};

export type ProductPricingChoice = {
  id: string;
  name: string;
  price: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChoicePricedProduct = MenuProductBase & {
  pricingMode: 'priced_by_choice';
  pricing: {
    choices: ProductPricingChoice[];
  };
};

export type MenuProduct = FixedPriceProduct | ChoicePricedProduct;

export type MenuCategory = {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  products: MenuProduct[];
};

export type MenuCategoryRequest = {
  name?: unknown;
};

export type FixedPriceProductRequest = {
  name?: unknown;
  description?: unknown;
  isAvailable?: unknown;
  price?: unknown;
  pricingMode?: unknown;
  pricing?: unknown;
};

export type MenuProductRequest = FixedPriceProductRequest;

export type MenuCategoryResponse = {
  category: MenuCategory;
};

export type FixedPriceProductResponse = {
  product: MenuProduct;
};

export type MenuProductResponse = FixedPriceProductResponse;

export type ListMenuCategoriesResponse = {
  categories: MenuCategory[];
};
