import { eq } from 'drizzle-orm';

import type { UpdateTenantProfileRequest } from '../contracts/tenant.js';
import { db } from '../db/index.js';
import { tenants } from '../db/schema.js';
import type { UpdateTenantProfileResult } from './tenant-types.js';

type TenantProfileUpdate = {
  name?: string;
  phone?: string;
  updatedAt: Date;
};

const providedString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : null;

export const updateTenantProfile = async (
  tenantId: string,
  request: UpdateTenantProfileRequest
): Promise<UpdateTenantProfileResult> => {
  const profileUpdate: TenantProfileUpdate = {
    updatedAt: new Date(),
  };

  if ('name' in request) {
    const name = providedString(request.name);

    if (!name) {
      return { ok: false, errorCode: 'INVALID_TENANT_PROFILE' };
    }

    profileUpdate.name = name;
  }

  if ('phone' in request) {
    const phone = providedString(request.phone);

    if (!phone) {
      return { ok: false, errorCode: 'INVALID_TENANT_PROFILE' };
    }

    profileUpdate.phone = phone;
  }

  if (!profileUpdate.name && !profileUpdate.phone) {
    return { ok: false, errorCode: 'INVALID_TENANT_PROFILE' };
  }

  const [tenant] = await db
    .update(tenants)
    .set(profileUpdate)
    .where(eq(tenants.id, tenantId))
    .returning({
      id: tenants.id,
      name: tenants.name,
      phone: tenants.phone,
    });

  if (!tenant) {
    return { ok: false, errorCode: 'TENANT_UPDATE_FAILED' };
  }

  return {
    ok: true,
    data: {
      tenant,
    },
  };
};
