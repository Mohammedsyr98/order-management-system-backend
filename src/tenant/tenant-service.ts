import { eq } from 'drizzle-orm';

import type {
  OperatingHours,
  UpdateTenantProfileRequest,
} from '../contracts/tenant.js';
import { db } from '../db/index.js';
import { tenants } from '../db/schema.js';
import type {
  TenantProfileResult,
  UpdateTenantProfileResult,
} from './tenant-types.js';
import { parseTenantProfileUpdate } from './tenant-validation.js';

type TenantProfileUpdate = {
  name?: string;
  phone?: string;
  timezone?: string;
  operatingHours?: OperatingHours;
  updatedAt: Date;
};

const tenantProfileSelect = {
  id: tenants.id,
  name: tenants.name,
  phone: tenants.phone,
  timezone: tenants.timezone,
  operatingHours: tenants.operatingHours,
};

export const getTenantProfile = async (
  tenantId: string
): Promise<TenantProfileResult> => {
  const [tenant] = await db
    .select(tenantProfileSelect)
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    return { ok: false, errorCode: 'TENANT_PROFILE_NOT_FOUND' };
  }

  return {
    ok: true,
    data: {
      tenant,
    },
  };
};

export const updateTenantProfile = async (
  tenantId: string,
  request: UpdateTenantProfileRequest
): Promise<UpdateTenantProfileResult> => {
  const validation = parseTenantProfileUpdate(request);

  if (!validation.success) {
    return { ok: false, errorCode: 'INVALID_TENANT_PROFILE' };
  }

  const profileUpdate: TenantProfileUpdate = {
    ...validation.data,
    updatedAt: new Date(),
  };

  const [tenant] = await db
    .update(tenants)
    .set(profileUpdate)
    .where(eq(tenants.id, tenantId))
    .returning(tenantProfileSelect);

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
