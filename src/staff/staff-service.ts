import { randomUUID } from 'node:crypto';

import { APIError } from 'better-auth';
import { eq } from 'drizzle-orm';

import { auth } from '../auth/auth.js';
import type { ResolvedAuthContext } from '../auth/auth-context.js';
import type { CreateStaffRequest } from '../contracts/staff.js';
import { isStaffRole } from '../contracts/roles.js';
import { db } from '../db/index.js';
import { tenantUsers, user } from '../db/schema.js';
import type { CreateStaffResult } from './staff-types.js';

const cleanupCreatedUser = async (userId: string) => {
  await db.delete(user).where(eq(user.id, userId));
};

export const createStaff = async (
  authContext: ResolvedAuthContext,
  request: CreateStaffRequest
): Promise<CreateStaffResult> => {
  if (!isStaffRole(request.role)) {
    return { ok: false, errorCode: 'INVALID_STAFF_ROLE' };
  }

  let createdUser: Awaited<ReturnType<typeof auth.api.signUpEmail>>['user'];

  try {
    const result = await auth.api.signUpEmail({
      body: {
        name: request.name,
        email: request.email,
        password: request.password,
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
        role: request.role,
      })
      .returning({
        tenantId: tenantUsers.tenantId,
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
          role: request.role,
        },
      },
    };
  } catch {
    await cleanupCreatedUser(createdUser.id);
    return { ok: false, errorCode: 'STAFF_CREATION_FAILED' };
  }
};
