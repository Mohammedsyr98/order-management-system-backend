import { describe, expect, it } from 'vitest';

import { isUniqueConstraintViolation } from '../db-errors.js';

const constraintName = 'menu_categories_tenant_name_unique_idx';

describe('isUniqueConstraintViolation', () => {
  it('matches a direct Postgres unique constraint error', () => {
    expect(
      isUniqueConstraintViolation(
        {
          code: '23505',
          constraint: constraintName,
        },
        constraintName
      )
    ).toBe(true);
  });

  it.each(['cause', 'sourceError'] as const)(
    'matches a unique constraint error nested under %s',
    (key) => {
      expect(
        isUniqueConstraintViolation(
          {
            message: 'Failed query.',
            [key]: {
              code: '23505',
              constraint: constraintName,
            },
          },
          constraintName
        )
      ).toBe(true);
    }
  );

  it('matches wrapped unique constraint errors that expose the constraint in text', () => {
    expect(
      isUniqueConstraintViolation(
        {
          sourceError: {
            code: '23505',
            message: `duplicate key value violates unique constraint "${constraintName}"`,
          },
        },
        constraintName
      )
    ).toBe(true);
  });

  it('does not match a different unique constraint', () => {
    expect(
      isUniqueConstraintViolation(
        {
          code: '23505',
          constraint: 'auth_users_email_unique',
        },
        constraintName
      )
    ).toBe(false);
  });

  it('does not match unique violations without evidence of the requested constraint', () => {
    expect(
      isUniqueConstraintViolation(
        {
          code: '23505',
        },
        constraintName
      )
    ).toBe(false);
  });

  it('does not match non-unique database errors', () => {
    expect(
      isUniqueConstraintViolation(
        {
          code: '42P01',
          message: constraintName,
        },
        constraintName
      )
    ).toBe(false);
  });

  it('handles cyclic error wrappers', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;

    expect(isUniqueConstraintViolation(error, constraintName)).toBe(false);
  });
});
