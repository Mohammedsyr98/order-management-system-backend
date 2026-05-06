import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/index.ts', () => ({
  db: {
    update: vi.fn(),
  },
}));

const { db } = await import('../db/index.js');
const { updateTenantProfile } = await import('./tenant-service.js');

const update = vi.mocked(db.update);

const mockTenantUpdate = (
  rows = [
    {
      id: 'tenant-1',
      name: 'Updated Tenant',
      phone: '+15551234567',
    },
  ]
) => {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });

  update.mockReturnValue({ set } as unknown as ReturnType<typeof db.update>);

  return { set };
};

describe('updateTenantProfile', () => {
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
});
