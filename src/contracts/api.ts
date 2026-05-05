export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'TENANT_MEMBERSHIP_REQUIRED'
  | 'FORBIDDEN'
  | 'INVALID_STAFF_ROLE'
  | 'STAFF_EMAIL_ALREADY_EXISTS'
  | 'STAFF_CREATION_FAILED';

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};
