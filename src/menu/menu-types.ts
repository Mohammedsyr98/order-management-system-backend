import type { ApiErrorCode } from '../contracts/api.js';
import type {
  FixedPriceProductResponse,
  ListMenuCategoriesResponse,
  MenuCategoryResponse,
} from '../contracts/menu.js';

export type CreateMenuCategoryErrorCode = Extract<
  ApiErrorCode,
  | 'INVALID_MENU_CATEGORY_REQUEST'
  | 'MENU_CATEGORY_NAME_ALREADY_EXISTS'
  | 'MENU_CATEGORY_CREATE_FAILED'
>;

export type UpdateMenuCategoryErrorCode = Extract<
  ApiErrorCode,
  | 'INVALID_MENU_CATEGORY_REQUEST'
  | 'MENU_CATEGORY_NOT_FOUND'
  | 'MENU_CATEGORY_NAME_ALREADY_EXISTS'
  | 'MENU_CATEGORY_UPDATE_FAILED'
>;

export type DeleteMenuCategoryErrorCode = Extract<
  ApiErrorCode,
  'MENU_CATEGORY_NOT_FOUND' | 'MENU_CATEGORY_DELETE_FAILED'
>;

export type CreateFixedPriceProductErrorCode = Extract<
  ApiErrorCode,
  | 'INVALID_MENU_PRODUCT_REQUEST'
  | 'MENU_CATEGORY_NOT_FOUND'
  | 'MENU_PRODUCT_NAME_ALREADY_EXISTS'
  | 'MENU_PRODUCT_CREATE_FAILED'
>;

export type UpdateFixedPriceProductErrorCode = Extract<
  ApiErrorCode,
  | 'INVALID_MENU_PRODUCT_REQUEST'
  | 'MENU_PRODUCT_NOT_FOUND'
  | 'MENU_PRODUCT_NAME_ALREADY_EXISTS'
  | 'MENU_PRODUCT_UPDATE_FAILED'
>;

export type DeleteFixedPriceProductErrorCode = Extract<
  ApiErrorCode,
  'MENU_PRODUCT_NOT_FOUND' | 'MENU_PRODUCT_DELETE_FAILED'
>;

export type ListMenuCategoriesResult = {
  ok: true;
  data: ListMenuCategoriesResponse;
};

export type CreateMenuCategoryResult =
  | {
      ok: true;
      data: MenuCategoryResponse;
    }
  | {
      ok: false;
      errorCode: CreateMenuCategoryErrorCode;
    };

export type UpdateMenuCategoryResult =
  | {
      ok: true;
      data: MenuCategoryResponse;
    }
  | {
      ok: false;
      errorCode: UpdateMenuCategoryErrorCode;
    };

export type DeleteMenuCategoryResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      errorCode: DeleteMenuCategoryErrorCode;
    };

export type CreateFixedPriceProductResult =
  | {
      ok: true;
      data: FixedPriceProductResponse;
    }
  | {
      ok: false;
      errorCode: CreateFixedPriceProductErrorCode;
    };

export type UpdateFixedPriceProductResult =
  | {
      ok: true;
      data: FixedPriceProductResponse;
    }
  | {
      ok: false;
      errorCode: UpdateFixedPriceProductErrorCode;
    };

export type DeleteFixedPriceProductResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      errorCode: DeleteFixedPriceProductErrorCode;
    };

export type MenuCategoryRouteErrorCode =
  | CreateMenuCategoryErrorCode
  | UpdateMenuCategoryErrorCode
  | DeleteMenuCategoryErrorCode;

export type FixedPriceProductRouteErrorCode =
  | CreateFixedPriceProductErrorCode
  | UpdateFixedPriceProductErrorCode
  | DeleteFixedPriceProductErrorCode;
