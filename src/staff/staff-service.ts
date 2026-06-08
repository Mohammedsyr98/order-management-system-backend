import { randomUUID } from 'node:crypto';

import { APIError } from 'better-auth';
import { and, asc, eq } from 'drizzle-orm';

import { auth } from '../auth/auth.js';
import type { ResolvedAuthContext } from '../auth/auth-context.js';
import type {
  CreateStaffRequest,
  ListManagersResponse,
  ManagerListItem,
  UpdateManagerProfileRequest,
} from '../contracts/staff.js';
import type { StaffRole } from '../contracts/roles.js';
import { db } from '../db/index.js';
import { tenantUsers, user } from '../db/schema.js';
import type {
  CreateStaffResult,
  UpdateManagerProfileResult,
} from './staff-types.js';
import {
  parseCreateStaffRequest,
  parseUpdateManagerProfileRequest,
} from './staff-validation.js';

const cleanupCreatedUser = async (userId: string) => {
  await db.delete(user).where(eq(user.id, userId));
};

const canCreateStaffRole = (
  creatorRole: ResolvedAuthContext['role'],
  staffRole: StaffRole
) =>
  creatorRole === 'owner' ||
  (creatorRole === 'manager' && staffRole === 'courier');

const managerProfileSelect = {
  id: user.id,
  name: user.name,
  email: user.email,
  tenantId: tenantUsers.tenantId,
  phone: tenantUsers.phone,
};

const findManagerProfile = async (
  tenantId: string,
  managerId: string
): Promise<ManagerListItem | null> => {
  const [manager] = await db
    .select(managerProfileSelect)
    .from(tenantUsers)
    .innerJoin(user, eq(user.id, tenantUsers.userId))
    .where(
      and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.userId, managerId),
        eq(tenantUsers.role, 'manager')
      )
    )
    .limit(1);

  if (!manager) {
    return null;
  }

  return {
    ...manager,
    role: 'manager',
  };
};

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
    .select(managerProfileSelect)
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

export const updateManagerProfile = async (
  tenantId: string,
  managerId: string,
  request: UpdateManagerProfileRequest
): Promise<UpdateManagerProfileResult> => {
  const validation = parseUpdateManagerProfileRequest(request);

  if (!validation.success) {
    return { ok: false, errorCode: 'INVALID_STAFF_REQUEST' };
  }

  const manager = await findManagerProfile(tenantId, managerId);

  if (!manager) {
    return { ok: false, errorCode: 'STAFF_MANAGER_NOT_FOUND' };
  }

  const update = validation.data;
  const updatedAt = new Date();

  if (update.phone !== undefined) {
    const [updatedMembership] = await db
      .update(tenantUsers)
      .set({ phone: update.phone, updatedAt })
      .where(
        and(
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.userId, managerId),
          eq(tenantUsers.role, 'manager')
        )
      )
      .returning({ userId: tenantUsers.userId });

    if (!updatedMembership) {
      return { ok: false, errorCode: 'STAFF_UPDATE_FAILED' };
    }
  }

  if (update.name !== undefined) {
    const [updatedUser] = await db
      .update(user)
      .set({ name: update.name, updatedAt })
      .where(eq(user.id, managerId))
      .returning({ id: user.id });

    if (!updatedUser) {
      return { ok: false, errorCode: 'STAFF_UPDATE_FAILED' };
    }
  }

  const updatedManager = await findManagerProfile(tenantId, managerId);

  if (!updatedManager) {
    return { ok: false, errorCode: 'STAFF_UPDATE_FAILED' };
  }

  return {
    ok: true,
    data: {
      manager: updatedManager,
    },
  };
};
