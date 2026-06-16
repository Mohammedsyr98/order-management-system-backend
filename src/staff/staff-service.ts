import { randomUUID } from 'node:crypto';

import { APIError } from 'better-auth';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { auth } from '../auth/auth.js';
import type { ResolvedAuthContext } from '../auth/auth-context.js';
import type {
  CourierListItem,
  CreateStaffRequest,
  ListCouriersResponse,
  ListManagersResponse,
  ManagerListItem,
  UpdateCourierProfileRequest,
  UpdateManagerProfileRequest,
  UpdateStaffProfileRequest,
} from '../contracts/staff.js';
import type { StaffRole } from '../contracts/roles.js';
import { db } from '../db/index.js';
import { tenantUsers, user } from '../db/schema.js';
import type {
  CreateStaffResult,
  DeleteManagerResult,
  UpdateCourierProfileResult,
  UpdateManagerProfileResult,
  UpdateStaffProfileResult,
} from './staff-types.js';
import {
  parseCreateStaffRequest,
  parseUpdateCourierProfileRequest,
  parseUpdateManagerProfileRequest,
  type ValidUpdateCourierProfileRequest,
  type ValidUpdateManagerProfileRequest,
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

const staffProfileSelect = {
  id: user.id,
  name: user.name,
  email: user.email,
  tenantId: tenantUsers.tenantId,
  phone: tenantUsers.phone,
};

type ManagedStaffRole = 'manager' | 'courier';
type ManagedStaffProfile = ManagerListItem | CourierListItem;
type ValidManagedStaffUpdate =
  | ValidUpdateManagerProfileRequest
  | ValidUpdateCourierProfileRequest;

const findStaffProfile = async (
  tenantId: string,
  staffId: string,
  role: ManagedStaffRole
): Promise<ManagedStaffProfile | null> => {
  const [staff] = await db
    .select(staffProfileSelect)
    .from(tenantUsers)
    .innerJoin(user, eq(user.id, tenantUsers.userId))
    .where(
      and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.userId, staffId),
        eq(tenantUsers.role, role)
      )
    )
    .limit(1);

  if (!staff) {
    return null;
  }

  return {
    ...staff,
    role,
  };
};

async function listStaffByRole(
  tenantId: string,
  role: 'manager'
): Promise<ManagerListItem[]>;
async function listStaffByRole(
  tenantId: string,
  role: 'courier'
): Promise<CourierListItem[]>;
async function listStaffByRole(
  tenantId: string,
  role: 'manager' | 'courier'
): Promise<Array<ManagerListItem | CourierListItem>> {
  const staff = await db
    .select(staffProfileSelect)
    .from(tenantUsers)
    .innerJoin(user, eq(user.id, tenantUsers.userId))
    .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.role, role)))
    .orderBy(asc(user.name), asc(user.email));

  return staff.map((staffMember) => ({
    ...staffMember,
    role,
  }));
}

const updateStaffProfileByRole = async (
  tenantId: string,
  staffId: string,
  role: ManagedStaffRole,
  update: ValidManagedStaffUpdate
): Promise<
  | { ok: true; profile: ManagedStaffProfile }
  | { ok: false; reason: 'NOT_FOUND' | 'UPDATE_FAILED' }
> => {
  const staff = await findStaffProfile(tenantId, staffId, role);

  if (!staff) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  const updatedAt = new Date();

  if (update.phone !== undefined) {
    const [updatedMembership] = await db
      .update(tenantUsers)
      .set({ phone: update.phone, updatedAt })
      .where(
        and(
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.userId, staffId),
          eq(tenantUsers.role, role)
        )
      )
      .returning({ userId: tenantUsers.userId });

    if (!updatedMembership) {
      return { ok: false, reason: 'UPDATE_FAILED' };
    }
  }

  if (update.name !== undefined) {
    const [updatedUser] = await db
      .update(user)
      .set({ name: update.name, updatedAt })
      .where(eq(user.id, staffId))
      .returning({ id: user.id });

    if (!updatedUser) {
      return { ok: false, reason: 'UPDATE_FAILED' };
    }
  }

  const updatedStaff = await findStaffProfile(tenantId, staffId, role);

  if (!updatedStaff) {
    return { ok: false, reason: 'UPDATE_FAILED' };
  }

  return { ok: true, profile: updatedStaff };
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
  return {
    managers: await listStaffByRole(tenantId, 'manager'),
  };
};

export const listCouriers = async (
  tenantId: string
): Promise<ListCouriersResponse> => {
  return {
    couriers: await listStaffByRole(tenantId, 'courier'),
  };
};

export const updateCourierProfile = async (
  tenantId: string,
  courierId: string,
  request: UpdateCourierProfileRequest
): Promise<UpdateCourierProfileResult> => {
  const validation = parseUpdateCourierProfileRequest(request);

  if (!validation.success) {
    return { ok: false, errorCode: 'INVALID_STAFF_REQUEST' };
  }

  const result = await updateStaffProfileByRole(
    tenantId,
    courierId,
    'courier',
    validation.data
  );

  if (!result.ok) {
    return {
      ok: false,
      errorCode:
        result.reason === 'NOT_FOUND'
          ? 'STAFF_COURIER_NOT_FOUND'
          : 'STAFF_UPDATE_FAILED',
    };
  }

  return {
    ok: true,
    data: {
      courier: result.profile as CourierListItem,
    },
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

  const result = await updateStaffProfileByRole(
    tenantId,
    managerId,
    'manager',
    validation.data
  );

  if (!result.ok) {
    return {
      ok: false,
      errorCode:
        result.reason === 'NOT_FOUND'
          ? 'STAFF_MANAGER_NOT_FOUND'
          : 'STAFF_UPDATE_FAILED',
    };
  }

  return {
    ok: true,
    data: {
      manager: result.profile as ManagerListItem,
    },
  };
};

export const updateOwnStaffProfile = async (
  authContext: ResolvedAuthContext,
  request: UpdateStaffProfileRequest
): Promise<UpdateStaffProfileResult> => {
  const result = await updateManagerProfile(
    authContext.tenantId,
    authContext.userId,
    request
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: {
      staff: result.data.manager,
    },
  };
};

export const deleteManager = async (
  tenantId: string,
  managerId: string
): Promise<DeleteManagerResult> => {
  try {
    const managerIds = db
      .select({ userId: tenantUsers.userId })
      .from(tenantUsers)
      .where(
        and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.role, 'manager'))
      );

    const [deletedManager] = await db
      .delete(user)
      .where(and(eq(user.id, managerId), inArray(user.id, managerIds)))
      .returning({ id: user.id });

    if (!deletedManager) {
      return { ok: false, errorCode: 'STAFF_MANAGER_NOT_FOUND' };
    }

    return { ok: true };
  } catch {
    return { ok: false, errorCode: 'STAFF_DELETE_FAILED' };
  }
};
