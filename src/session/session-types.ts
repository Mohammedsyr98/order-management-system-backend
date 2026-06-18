export type {
  AppSessionContext,
  AppSessionUser,
  SignInEmailResultWithHeaders,
} from '../auth/app-session-context-types.js';

export type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};
