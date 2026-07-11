const uniqueConstraintViolationCode = '23505';
const nestedDatabaseErrorKeys = ['cause', 'sourceError'] as const;

type DatabaseErrorLike = {
  code?: unknown;
  constraint?: unknown;
  detail?: unknown;
  message?: unknown;
  cause?: unknown;
  sourceError?: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const mentionsConstraint = (error: DatabaseErrorLike, constraintName: string) =>
  error.constraint === constraintName ||
  (typeof error.message === 'string' &&
    error.message.includes(constraintName)) ||
  (typeof error.detail === 'string' && error.detail.includes(constraintName));

export const isUniqueConstraintViolation = (
  error: unknown,
  constraintName: string
): boolean => {
  const visited = new Set<unknown>();

  const visit = (candidate: unknown): boolean => {
    if (!isObject(candidate) || visited.has(candidate)) {
      return false;
    }

    visited.add(candidate);

    const databaseError = candidate as DatabaseErrorLike;

    if (
      databaseError.code === uniqueConstraintViolationCode &&
      mentionsConstraint(databaseError, constraintName)
    ) {
      return true;
    }

    return nestedDatabaseErrorKeys.some((key) => visit(databaseError[key]));
  };

  return visit(error);
};
