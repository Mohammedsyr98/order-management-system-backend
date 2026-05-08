import { randomUUID } from 'node:crypto';

import { APIError } from 'better-auth';
import { and, asc, eq } from 'drizzle-orm';

import { auth } from '../auth/auth.js';
import type { ResolvedAuthContext } from '../auth/auth-context.js';
import type {
  CreateStaffRequest,
  ListManagersResponse,
} from '../contracts/staff.js';
import type { StaffRole } from '../contracts/roles.js';
import { db } from '../db/index.js';
import { tenantUsers, user } from '../db/schema.js';
import type { CreateStaffResult } from './staff-types.js';
import { parseCreateStaffRequest } from './staff-validation.js';

const cleanupCreatedUser = async (userId: string) => {
  await db.delete(user).where(eq(user.id, userId));
};

const canCreateStaffRole = (
  creatorRole: ResolvedAuthContext['role'],
  staffRole: StaffRole
) =>
  creatorRole === 'owner' ||
  (creatorRole === 'manager' && staffRole === 'courier');

export const createStaff = async (
  authContext: ResolvedAuthContext,
  request: CreateStaffRequest
): Promise<CreateStaffResult> => {
  const validation = parseCreateStaffRequest(request);

  if (!validation.success) {
    return { ok: false, errorCode: 'INVALID_STAFF_REQUEST' };
  }

  const staff = validation.data;

  if (!canCreateStaffRole(authContext.role, staff.role)) {
    return { ok: false, errorCode: 'FORBIDDEN' };
  }

  let createdUser: Awaited<ReturnType<typeof auth.api.signUpEmail>>['user'];

  try {
    const result = await auth.api.signUpEmail({
      body: {
        name: staff.name,
        email: staff.email,
        password: staff.password,
      },
    });
    createdUser = result.user;
  } catch (error) {
    if (
      error instanceof APIError &&
      error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
    ) {
      return { ok: false, errorCode: 'STAFF_EMAIL_ALREADY_EXISTS' };
    }

    return { ok: false, errorCode: 'STAFF_CREATION_FAILED' };
  }

  try {
    const [membership] = await db
      .insert(tenantUsers)
      .values({
        id: randomUUID(),
        tenantId: authContext.tenantId,
        userId: createdUser.id,
        role: staff.role,
        phone: staff.phone,
      })
      .returning({
        tenantId: tenantUsers.tenantId,
        phone: tenantUsers.phone,
      });

    if (!membership) {
      await cleanupCreatedUser(createdUser.id);
      return { ok: false, errorCode: 'STAFF_CREATION_FAILED' };
    }

    return {
      ok: true,
      data: {
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
        },
        membership: {
          tenantId: membership.tenantId,
          role: staff.role,
          phone: membership.phone,
        },
      },
    };
  } catch {
    await cleanupCreatedUser(createdUser.id);
    return { ok: false, errorCode: 'STAFF_CREATION_FAILED' };
  }
};

export const listManagers = async (
  tenantId: string
): Promise<ListManagersResponse> => {
  const managers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      tenantId: tenantUsers.tenantId,
      phone: tenantUsers.phone,
    })
    .from(tenantUsers)
    .innerJoin(user, eq(user.id, tenantUsers.userId))
    .where(
      and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.role, 'manager'))
    )
    .orderBy(asc(user.name), asc(user.email));

  return {
    managers: managers.map((manager) => ({
      ...manager,
      role: 'manager',
    })),
  };
};
