import type { ApiErrorCode } from '../contracts/api.js';
import type {
  ListMenuAddOnGroupsResponse,
  ListMenuCategoriesResponse,
  MenuAddOnGroupResponse,
  MenuCategoryResponse,
  MenuProductResponse,
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

export type CreateMenuProductErrorCode = CreateFixedPriceProductErrorCode;

export type UpdateFixedPriceProductErrorCode = Extract<
  ApiErrorCode,
  | 'INVALID_MENU_PRODUCT_REQUEST'
  | 'MENU_PRODUCT_NOT_FOUND'
  | 'MENU_PRODUCT_NAME_ALREADY_EXISTS'
  | 'MENU_PRODUCT_UPDATE_FAILED'
>;

export type UpdateMenuProductErrorCode = UpdateFixedPriceProductErrorCode;

export type DeleteFixedPriceProductErrorCode = Extract<
  ApiErrorCode,
  'MENU_PRODUCT_NOT_FOUND' | 'MENU_PRODUCT_DELETE_FAILED'
>;

export type DeleteMenuProductErrorCode = DeleteFixedPriceProductErrorCode;

export type CreateMenuAddOnGroupErrorCode = Extract<
  ApiErrorCode,
  | 'INVALID_MENU_ADD_ON_GROUP_REQUEST'
  | 'MENU_ADD_ON_GROUP_NAME_ALREADY_EXISTS'
  | 'MENU_ADD_ON_GROUP_CREATE_FAILED'
>;

export type UpdateMenuAddOnGroupErrorCode = Extract<
  ApiErrorCode,
  | 'INVALID_MENU_ADD_ON_GROUP_REQUEST'
  | 'MENU_ADD_ON_GROUP_NOT_FOUND'
  | 'MENU_ADD_ON_GROUP_NAME_ALREADY_EXISTS'
  | 'MENU_ADD_ON_GROUP_UPDATE_FAILED'
>;

export type DeleteMenuAddOnGroupErrorCode = Extract<
  ApiErrorCode,
  'MENU_ADD_ON_GROUP_NOT_FOUND' | 'MENU_ADD_ON_GROUP_DELETE_FAILED'
>;

export type ListMenuCategoriesResult = {
  ok: true;
  data: ListMenuCategoriesResponse;
};

export type ListMenuAddOnGroupsResult = {
  ok: true;
  data: ListMenuAddOnGroupsResponse;
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
      data: MenuProductResponse;
    }
  | {
      ok: false;
      errorCode: CreateFixedPriceProductErrorCode;
    };

export type CreateMenuProductResult = CreateFixedPriceProductResult;

export type UpdateFixedPriceProductResult =
  | {
      ok: true;
      data: MenuProductResponse;
    }
  | {
      ok: false;
      errorCode: UpdateFixedPriceProductErrorCode;
    };

export type UpdateMenuProductResult = UpdateFixedPriceProductResult;

export type DeleteFixedPriceProductResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      errorCode: DeleteFixedPriceProductErrorCode;
    };

export type DeleteMenuProductResult = DeleteFixedPriceProductResult;

export type CreateMenuAddOnGroupResult =
  | {
      ok: true;
      data: MenuAddOnGroupResponse;
    }
  | {
      ok: false;
      errorCode: CreateMenuAddOnGroupErrorCode;
    };

export type UpdateMenuAddOnGroupResult =
  | {
      ok: true;
      data: MenuAddOnGroupResponse;
    }
  | {
      ok: false;
      errorCode: UpdateMenuAddOnGroupErrorCode;
    };

export type DeleteMenuAddOnGroupResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      errorCode: DeleteMenuAddOnGroupErrorCode;
    };

export type MenuCategoryRouteErrorCode =
  | CreateMenuCategoryErrorCode
  | UpdateMenuCategoryErrorCode
  | DeleteMenuCategoryErrorCode;

export type FixedPriceProductRouteErrorCode =
  | CreateFixedPriceProductErrorCode
  | UpdateFixedPriceProductErrorCode
  | DeleteFixedPriceProductErrorCode;

export type MenuProductRouteErrorCode = FixedPriceProductRouteErrorCode;

export type MenuAddOnGroupRouteErrorCode =
  | CreateMenuAddOnGroupErrorCode
  | UpdateMenuAddOnGroupErrorCode
  | DeleteMenuAddOnGroupErrorCode;
