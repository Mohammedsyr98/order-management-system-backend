import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { count, eq } from 'drizzle-orm';

import { auth } from '../src/auth/auth.js';
import { db } from '../src/db/index.js';
import { tenantUsers, tenants, user } from '../src/db/schema.js';

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const main = async () => {
  const tenantName = requiredEnv('OWNER_TENANT_NAME');
  const ownerName = requiredEnv('OWNER_NAME');
  const ownerEmail = requiredEnv('OWNER_EMAIL').toLowerCase();
  const ownerPassword = requiredEnv('OWNER_PASSWORD');

  const [tenantCount] = await db.select({ count: count() }).from(tenants);
  if ((tenantCount?.count ?? 0) > 0) {
    throw new Error('Owner creation can only run when no tenants exist.');
  }

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, ownerEmail))
    .limit(1);

  if (existingUser) {
    throw new Error('A user with OWNER_EMAIL already exists.');
  }

  const result = await auth.api.signUpEmail({
    body: {
      name: ownerName,
      email: ownerEmail,
      password: ownerPassword,
    },
  });

  const createdUser = result.user;
  let createdTenantId: string | undefined;
  let createdTenantUserId: string | undefined;

  try {
    createdTenantId = randomUUID();
    const [tenant] = await db
      .insert(tenants)
      .values({
        id: createdTenantId,
        name: tenantName,
      })
      .returning({ id: tenants.id, name: tenants.name });

    if (!tenant) {
      throw new Error('Failed to create tenant.');
    }

    createdTenantUserId = randomUUID();
    const [tenantUser] = await db
      .insert(tenantUsers)
      .values({
        id: createdTenantUserId,
        tenantId: tenant.id,
        userId: createdUser.id,
        role: 'owner',
      })
      .returning({ id: tenantUsers.id });

    if (!tenantUser) {
      throw new Error('Failed to create owner membership.');
    }

    console.log(`Created tenant "${tenant.name}" (${tenant.id})`);
    console.log(`Created owner "${createdUser.email}" (${createdUser.id})`);
  } catch (error) {
    if (createdTenantUserId) {
      await db
        .delete(tenantUsers)
        .where(eq(tenantUsers.id, createdTenantUserId));
    }
    if (createdTenantId) {
      await db.delete(tenants).where(eq(tenants.id, createdTenantId));
    }
    await db.delete(user).where(eq(user.id, createdUser.id));

    throw error;
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error.';

  console.error(message);
  process.exitCode = 1;
});
