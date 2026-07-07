import { eq } from 'drizzle-orm';

import { db } from '../../db/index.js';
import { tenantUsers, user as authUsers } from '../../db/schema.js';
import {
  insertTenantMembership,
  insertUser,
} from '../../test/test-db.js';

type StaffRole = 'owner' | 'manager' | 'courier';

type InsertStaffMemberOptions = {
  id?: string;
  tenantId?: string;
  role?: StaffRole;
  name?: string;
  email?: string;
  phone?: string | null;
};

export const insertStaffMember = async (
  options: InsertStaffMemberOptions = {}
) => {
  const {
    id = 'staff-1',
    tenantId = 'tenant-1',
    role = 'manager',
    name = 'Staff User',
    email = `${id}@example.com`,
    phone = null,
  } = options;

  await insertUser({
    id,
    name,
    email,
  });

  await insertTenantMembership({
    id: `tenant-user-${id}`,
    tenantId,
    userId: id,
    role,
    phone,
  });

  return {
    id,
    tenantId,
    role,
    name,
    email,
    phone,
  };
};

export const getPersistedAuthUser = async (id = 'staff-1') => {
  const [persistedUser] = await db
    .select({
      id: authUsers.id,
      name: authUsers.name,
      email: authUsers.email,
    })
    .from(authUsers)
    .where(eq(authUsers.id, id))
    .limit(1);

  return persistedUser ?? null;
};

export const getPersistedMembership = async (userId = 'staff-1') => {
  const [membership] = await db
    .select({
      tenantId: tenantUsers.tenantId,
      userId: tenantUsers.userId,
      role: tenantUsers.role,
      phone: tenantUsers.phone,
    })
    .from(tenantUsers)
    .where(eq(tenantUsers.userId, userId))
    .limit(1);

  return membership ?? null;
};
