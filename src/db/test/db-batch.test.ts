import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required for db-batch.test.ts');
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { resetTenantTestData } = await import('../../test/test-db.js');
const { db } = await import('../index.js');
const { user: authUsers } = await import('../schema.js');

describe('database batch behavior', () => {
  beforeEach(async () => {
    await resetTenantTestData();
  });

  it('rolls back earlier statements when a later batched statement fails', async () => {
    await expect(
      db.batch([
        db.insert(authUsers).values({
          id: 'batch-user-1',
          name: 'Batch User',
          email: 'batch@example.com',
          emailVerified: true,
        }),
        db.insert(authUsers).values({
          id: 'batch-user-2',
          name: 'Duplicate Batch User',
          email: 'batch@example.com',
          emailVerified: true,
        }),
      ])
    ).rejects.toThrow();

    const persistedUsers = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.id, 'batch-user-1'));

    expect(persistedUsers).toEqual([]);
  });
});
