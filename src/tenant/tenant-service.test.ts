import { beforeEach, describe, expect, it } from 'vitest';
import 'dotenv/config';

import type { OperatingHours } from '../contracts/tenant.js';

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { defaultOperatingHours } = await import('../contracts/tenant.js');
const { insertTenant, resetTenantTestData } =
  await import('../test/test-db.js');
const { getTenantProfile, updateTenantProfile } =
  await import('./tenant-service.js');

const tenantProfile = (
  overrides: Partial<{
    id: string;
    name: string;
    phone: string;
    timezone: string;
    operatingHours: OperatingHours;
  }> = {}
) => ({
  id: 'tenant-1',
  name: 'Main Tenant',
  phone: '+15550000000',
  timezone: 'Europe/Istanbul',
  operatingHours: defaultOperatingHours,
  ...overrides,
});

const expectPersistedTenantProfile = async (
  expected: ReturnType<typeof tenantProfile>
) => {
  await expect(getTenantProfile(expected.id)).resolves.toEqual({
    ok: true,
    data: {
      tenant: expected,
    },
  });
};

describe('updateTenantProfile', () => {
  beforeEach(async () => {
    await resetTenantTestData();
  });

  it('requires at least one tenant profile field and leaves the tenant unchanged', async () => {
    await insertTenant();

    const result = await updateTenantProfile('tenant-1', {});

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    await expectPersistedTenantProfile(tenantProfile());
  });

  it('rejects blank provided tenant profile fields and leaves the tenant unchanged', async () => {
    await insertTenant();

    const result = await updateTenantProfile('tenant-1', {
      name: 'Updated Tenant',
      phone: '',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    await expectPersistedTenantProfile(tenantProfile());
  });

  it('trims and persists the provided tenant name while preserving other fields', async () => {
    await insertTenant();

    const result = await updateTenantProfile('tenant-1', {
      name: ' Updated Tenant ',
    });

    const expectedTenant = tenantProfile({ name: 'Updated Tenant' });
    expect(result).toEqual({
      ok: true,
      data: {
        tenant: expectedTenant,
      },
    });
    await expectPersistedTenantProfile(expectedTenant);
  });

  it('trims and persists the provided tenant phone while preserving other fields', async () => {
    await insertTenant({ name: 'Existing Tenant' });

    const result = await updateTenantProfile('tenant-1', {
      phone: ' +15551234567 ',
    });

    const expectedTenant = tenantProfile({
      name: 'Existing Tenant',
      phone: '+15551234567',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        tenant: expectedTenant,
      },
    });
    await expectPersistedTenantProfile(expectedTenant);
  });

  it('trims and persists the provided tenant name and phone', async () => {
    await insertTenant();

    const result = await updateTenantProfile('tenant-1', {
      name: ' Updated Tenant ',
      phone: ' +15551234567 ',
    });

    const expectedTenant = tenantProfile({
      name: 'Updated Tenant',
      phone: '+15551234567',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        tenant: expectedTenant,
      },
    });
    await expectPersistedTenantProfile(expectedTenant);
  });

  it('trims and persists the provided tenant timezone while preserving other fields', async () => {
    await insertTenant({ name: 'Existing Tenant' });

    const result = await updateTenantProfile('tenant-1', {
      timezone: ' Asia/Dubai ',
    });

    const expectedTenant = tenantProfile({
      name: 'Existing Tenant',
      timezone: 'Asia/Dubai',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        tenant: expectedTenant,
      },
    });
    await expectPersistedTenantProfile(expectedTenant);
  });

  it('rejects invalid tenant timezones and leaves the tenant unchanged', async () => {
    await insertTenant();

    const result = await updateTenantProfile('tenant-1', {
      timezone: 'GMT+3',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    await expectPersistedTenantProfile(tenantProfile());
  });

  it('persists valid tenant operating hours', async () => {
    await insertTenant();
    const operatingHours = {
      ...defaultOperatingHours,
      sunday: { status: 'open', open: '10:00', close: '14:00' },
    } satisfies OperatingHours;

    const result = await updateTenantProfile('tenant-1', {
      operatingHours,
    });

    const expectedTenant = tenantProfile({ operatingHours });
    expect(result).toEqual({
      ok: true,
      data: {
        tenant: expectedTenant,
      },
    });
    await expectPersistedTenantProfile(expectedTenant);
  });

  it('rejects incomplete tenant operating hours and leaves the tenant unchanged', async () => {
    await insertTenant();
    const { sunday: _sunday, ...incompleteHours } = defaultOperatingHours;

    const result = await updateTenantProfile('tenant-1', {
      operatingHours: incompleteHours,
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    await expectPersistedTenantProfile(tenantProfile());
  });

  it('rejects malformed tenant operating hour intervals and leaves the tenant unchanged', async () => {
    await insertTenant();

    const result = await updateTenantProfile('tenant-1', {
      operatingHours: {
        ...defaultOperatingHours,
        monday: { status: 'open', open: '17:00', close: '09:00' },
      },
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    await expectPersistedTenantProfile(tenantProfile());
  });

  it('rejects closed tenant operating days with hours and leaves the tenant unchanged', async () => {
    await insertTenant();

    const result = await updateTenantProfile('tenant-1', {
      operatingHours: {
        ...defaultOperatingHours,
        monday: { status: 'closed', open: '09:00', close: '17:00' },
      },
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    await expectPersistedTenantProfile(tenantProfile());
  });

  it('rejects clearing tenant operating hours and leaves the tenant unchanged', async () => {
    await insertTenant();

    const result = await updateTenantProfile('tenant-1', {
      operatingHours: null,
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    await expectPersistedTenantProfile(tenantProfile());
  });

  it('returns update failed when the tenant profile does not exist', async () => {
    const result = await updateTenantProfile('tenant-1', {
      name: 'Updated Tenant',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'TENANT_UPDATE_FAILED',
    });
  });
});

describe('getTenantProfile', () => {
  beforeEach(async () => {
    await resetTenantTestData();
  });

  it('returns not found when the tenant profile does not exist', async () => {
    const result = await getTenantProfile('tenant-1');

    expect(result).toEqual({
      ok: false,
      errorCode: 'TENANT_PROFILE_NOT_FOUND',
    });
  });

  it('returns the full persisted tenant profile', async () => {
    await insertTenant();

    const result = await getTenantProfile('tenant-1');

    expect(result).toEqual({
      ok: true,
      data: {
        tenant: tenantProfile(),
      },
    });
  });
});
