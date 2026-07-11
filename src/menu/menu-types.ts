import type { ApiErrorCode } from '../contracts/api.js';
import type {
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

export type MenuCategoryRouteErrorCode =
  | CreateMenuCategoryErrorCode
  | UpdateMenuCategoryErrorCode
  | DeleteMenuCategoryErrorCode;
