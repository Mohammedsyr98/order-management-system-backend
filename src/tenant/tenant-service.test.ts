import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/index.ts', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

const { db } = await import('../db/index.js');
const { getTenantProfile, updateTenantProfile } =
  await import('./tenant-service.js');

const select = vi.mocked(db.select);
const update = vi.mocked(db.update);

const defaultOperatingHours = {
  monday: { status: 'open', open: '09:00', close: '17:00' },
  tuesday: { status: 'open', open: '09:00', close: '17:00' },
  wednesday: { status: 'open', open: '09:00', close: '17:00' },
  thursday: { status: 'open', open: '09:00', close: '17:00' },
  friday: { status: 'open', open: '09:00', close: '17:00' },
  saturday: { status: 'open', open: '09:00', close: '17:00' },
  sunday: { status: 'closed' },
};

const mockTenantUpdate = (
  rows = [
    {
      id: 'tenant-1',
      name: 'Updated Tenant',
      phone: '+15551234567',
      timezone: 'Europe/Istanbul',
      operatingHours: defaultOperatingHours,
    },
  ]
) => {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });

  update.mockReturnValue({ set } as unknown as ReturnType<typeof db.update>);

  return { set };
};

const mockTenantProfileRows = (
  rows = [
    {
      id: 'tenant-1',
      name: 'Main Tenant',
      phone: '+15550000000',
      timezone: 'Europe/Istanbul',
      operatingHours: defaultOperatingHours,
    },
  ]
) => {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });

  select.mockReturnValue({ from } as unknown as ReturnType<typeof db.select>);
};

describe('updateTenantProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires at least one tenant profile field', async () => {
    const result = await updateTenantProfile('tenant-1', {});

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects blank provided tenant profile fields', async () => {
    const result = await updateTenantProfile('tenant-1', {
      name: 'Updated Tenant',
      phone: '',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('updates only the provided tenant name', async () => {
    const { set } = mockTenantUpdate([
      {
        id: 'tenant-1',
        name: 'Updated Tenant',
        phone: '+15550000000',
        timezone: 'Europe/Istanbul',
        operatingHours: defaultOperatingHours,
      },
    ]);

    const result = await updateTenantProfile('tenant-1', {
      name: ' Updated Tenant ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        tenant: {
          id: 'tenant-1',
          name: 'Updated Tenant',
          phone: '+15550000000',
          timezone: 'Europe/Istanbul',
          operatingHours: defaultOperatingHours,
        },
      },
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated Tenant',
      })
    );
    expect(set).not.toHaveBeenCalledWith(
      expect.objectContaining({
        phone: expect.any(String),
      })
    );
  });

  it('updates only the provided tenant phone', async () => {
    const { set } = mockTenantUpdate([
      {
        id: 'tenant-1',
        name: 'Existing Tenant',
        phone: '+15551234567',
        timezone: 'Europe/Istanbul',
        operatingHours: defaultOperatingHours,
      },
    ]);

    const result = await updateTenantProfile('tenant-1', {
      phone: ' +15551234567 ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        tenant: {
          id: 'tenant-1',
          name: 'Existing Tenant',
          phone: '+15551234567',
          timezone: 'Europe/Istanbul',
          operatingHours: defaultOperatingHours,
        },
      },
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+15551234567',
      })
    );
    expect(set).not.toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.any(String),
      })
    );
  });

  it('updates the tenant with trimmed name and phone', async () => {
    const { set } = mockTenantUpdate();

    const result = await updateTenantProfile('tenant-1', {
      name: ' Updated Tenant ',
      phone: ' +15551234567 ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        tenant: {
          id: 'tenant-1',
          name: 'Updated Tenant',
          phone: '+15551234567',
          timezone: 'Europe/Istanbul',
          operatingHours: defaultOperatingHours,
        },
      },
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated Tenant',
        phone: '+15551234567',
      })
    );
  });

  it('updates only the provided tenant timezone', async () => {
    const { set } = mockTenantUpdate([
      {
        id: 'tenant-1',
        name: 'Existing Tenant',
        phone: '+15550000000',
        timezone: 'Asia/Dubai',
        operatingHours: defaultOperatingHours,
      },
    ]);

    const result = await updateTenantProfile('tenant-1', {
      timezone: ' Asia/Dubai ',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        tenant: {
          id: 'tenant-1',
          name: 'Existing Tenant',
          phone: '+15550000000',
          timezone: 'Asia/Dubai',
          operatingHours: defaultOperatingHours,
        },
      },
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        timezone: 'Asia/Dubai',
      })
    );
  });

  it('rejects invalid tenant timezones', async () => {
    const result = await updateTenantProfile('tenant-1', {
      timezone: 'GMT+3',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('updates only the provided tenant operating hours', async () => {
    const { set } = mockTenantUpdate();

    const result = await updateTenantProfile('tenant-1', {
      operatingHours: defaultOperatingHours,
    });

    expect(result.ok).toBe(true);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        operatingHours: defaultOperatingHours,
      })
    );
  });

  it('rejects incomplete tenant operating hours', async () => {
    const { sunday: _sunday, ...incompleteHours } = defaultOperatingHours;

    const result = await updateTenantProfile('tenant-1', {
      operatingHours: incompleteHours,
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects malformed tenant operating hour intervals', async () => {
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
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects closed tenant operating days with hours', async () => {
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
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects clearing tenant operating hours', async () => {
    const result = await updateTenantProfile('tenant-1', {
      operatingHours: null,
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_TENANT_PROFILE',
    });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('getTenantProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns not found when the tenant profile does not exist', async () => {
    mockTenantProfileRows([]);

    const result = await getTenantProfile('tenant-1');

    expect(result).toEqual({
      ok: false,
      errorCode: 'TENANT_PROFILE_NOT_FOUND',
    });
  });

  it('returns the full tenant profile', async () => {
    mockTenantProfileRows();

    const result = await getTenantProfile('tenant-1');

    expect(result).toEqual({
      ok: true,
      data: {
        tenant: {
          id: 'tenant-1',
          name: 'Main Tenant',
          phone: '+15550000000',
          timezone: 'Europe/Istanbul',
          operatingHours: defaultOperatingHours,
        },
      },
    });
  });
});
