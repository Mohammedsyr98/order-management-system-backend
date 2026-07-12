import 'dotenv/config';
import { beforeEach, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for menu-add-on-group-service.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { insertTenant, resetTenantTestData } =
  await import('../../test/test-db.js');
const { insertMenuAddOnGroup, insertMenuAddOnItem, insertMenuCategory } =
  await import('./test-support.js');
const {
  createMenuAddOnGroup,
  deleteMenuAddOnGroup,
  listMenuAddOnGroups,
  updateMenuAddOnGroup,
} = await import('../menu-service.js');

const addOnGroupResponse = ({
  id,
  tenantId = 'tenant-1',
  name,
  items,
}: {
  id: string;
  tenantId?: string;
  name: string;
  items: Array<{
    id: string;
    groupId: string;
    name: string;
    price: string;
    isAvailable: boolean;
  }>;
}) => ({
  id,
  tenantId,
  name,
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
  items: items.map((item) => ({
    ...item,
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  })),
});

describe('menu add-on group service', () => {
  beforeEach(async () => {
    await resetTenantTestData();
  });

  it('creates, lists, updates, and hard-deletes an add-on group in a tenant', async () => {
    await insertTenant();

    const created = await createMenuAddOnGroup('tenant-1', {
      name: ' Drinks ',
      items: [
        { name: ' Ayran ', price: '30.7' },
        { name: 'Kola', price: '40.00', isAvailable: false },
      ],
    });

    expect(created).toEqual({
      ok: true,
      data: {
        addOnGroup: addOnGroupResponse({
          id: expect.any(String),
          name: 'Drinks',
          items: [
            {
              id: expect.any(String),
              groupId: expect.any(String),
              name: 'Ayran',
              price: '30.70',
              isAvailable: true,
            },
            {
              id: expect.any(String),
              groupId: expect.any(String),
              name: 'Kola',
              price: '40.00',
              isAvailable: false,
            },
          ],
        }),
      },
    });

    if (!created.ok) {
      throw new Error('Expected add-on group creation to succeed.');
    }

    const groupId = created.data.addOnGroup.id;
    const createdItems = created.data.addOnGroup.items;

    await expect(listMenuAddOnGroups('tenant-1')).resolves.toEqual({
      ok: true,
      data: {
        addOnGroups: [
          addOnGroupResponse({
            id: groupId,
            name: 'Drinks',
            items: createdItems,
          }),
        ],
      },
    });

    const updated = await updateMenuAddOnGroup('tenant-1', groupId, {
      name: ' Extras ',
      items: [
        { name: 'Extra cheese', price: '15', isAvailable: true },
        { name: 'Hot sauce', price: '0', isAvailable: false },
      ],
    });

    expect(updated).toEqual({
      ok: true,
      data: {
        addOnGroup: addOnGroupResponse({
          id: groupId,
          name: 'Extras',
          items: [
            {
              id: expect.any(String),
              groupId,
              name: 'Extra cheese',
              price: '15.00',
              isAvailable: true,
            },
            {
              id: expect.any(String),
              groupId,
              name: 'Hot sauce',
              price: '0.00',
              isAvailable: false,
            },
          ],
        }),
      },
    });

    if (!updated.ok) {
      throw new Error('Expected add-on group update to succeed.');
    }

    const originalItemIds = new Set(createdItems.map((item) => item.id));

    expect(
      updated.data.addOnGroup.items.some((item) => originalItemIds.has(item.id))
    ).toBe(false);

    await expect(deleteMenuAddOnGroup('tenant-1', groupId)).resolves.toEqual({
      ok: true,
    });

    await expect(listMenuAddOnGroups('tenant-1')).resolves.toEqual({
      ok: true,
      data: { addOnGroups: [] },
    });
  });

  it('lists only add-on groups in the requested tenant in stable order', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertMenuAddOnGroup({
      id: 'add-on-group-2',
      name: 'Extras',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await insertMenuAddOnItem({
      id: 'add-on-item-2',
      groupId: 'add-on-group-2',
      name: 'Ayran',
      priceMinorUnits: 3000,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await insertMenuAddOnGroup({
      id: 'add-on-group-1',
      name: 'Drinks',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await insertMenuAddOnItem({
      id: 'add-on-item-1',
      groupId: 'add-on-group-1',
      name: 'Ayran',
      priceMinorUnits: 3075,
      isAvailable: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await insertMenuAddOnGroup({
      id: 'other-tenant-add-on-group-1',
      tenantId: 'tenant-2',
      name: 'Drinks',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    await insertMenuAddOnItem({
      id: 'other-tenant-add-on-item-1',
      groupId: 'other-tenant-add-on-group-1',
      name: 'Ayran',
      priceMinorUnits: 2000,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    await expect(listMenuAddOnGroups('tenant-1')).resolves.toEqual({
      ok: true,
      data: {
        addOnGroups: [
          addOnGroupResponse({
            id: 'add-on-group-1',
            name: 'Drinks',
            items: [
              {
                id: 'add-on-item-1',
                groupId: 'add-on-group-1',
                name: 'Ayran',
                price: '30.75',
                isAvailable: false,
              },
            ],
          }),
          addOnGroupResponse({
            id: 'add-on-group-2',
            name: 'Extras',
            items: [
              {
                id: 'add-on-item-2',
                groupId: 'add-on-group-2',
                name: 'Ayran',
                price: '30.00',
                isAvailable: true,
              },
            ],
          }),
        ],
      },
    });
  });

  it('rejects duplicate group names within a tenant while keeping categories and groups separate', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertMenuCategory({ id: 'category-1', name: 'Drinks' });

    await expect(
      createMenuAddOnGroup('tenant-1', {
        name: 'Drinks',
        items: [{ name: 'Ayran', price: '30.00' }],
      })
    ).resolves.toMatchObject({
      ok: true,
      data: {
        addOnGroup: {
          tenantId: 'tenant-1',
          name: 'Drinks',
        },
      },
    });

    await expect(
      createMenuAddOnGroup('tenant-1', {
        name: ' drinks ',
        items: [{ name: 'Kola', price: '40.00' }],
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_ADD_ON_GROUP_NAME_ALREADY_EXISTS',
    });

    await expect(
      createMenuAddOnGroup('tenant-2', {
        name: 'drinks',
        items: [{ name: 'Ayran', price: '25.00' }],
      })
    ).resolves.toMatchObject({
      ok: true,
      data: {
        addOnGroup: {
          tenantId: 'tenant-2',
          name: 'drinks',
        },
      },
    });
  });

  it('returns not found when updating or deleting another tenant add-on group', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertMenuAddOnGroup({
      id: 'other-tenant-add-on-group-1',
      tenantId: 'tenant-2',
      name: 'Drinks',
    });

    await expect(
      updateMenuAddOnGroup('tenant-1', 'other-tenant-add-on-group-1', {
        name: 'Renamed',
        items: [{ name: 'Ayran', price: '30.00', isAvailable: true }],
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND',
    });

    await expect(
      deleteMenuAddOnGroup('tenant-1', 'other-tenant-add-on-group-1')
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND',
    });
  });

  it.each([
    ['missing name', { items: [{ name: 'Ayran', price: '30.00' }] }],
    ['blank name', { name: '   ', items: [{ name: 'Ayran', price: '30.00' }] }],
    ['missing items', { name: 'Drinks' }],
    ['empty items', { name: 'Drinks', items: [] }],
    [
      'duplicate item names',
      {
        name: 'Drinks',
        items: [
          { name: 'Ayran', price: '30.00' },
          { name: ' ayran ', price: '35.00' },
        ],
      },
    ],
    [
      'invalid item price',
      { name: 'Drinks', items: [{ name: 'Ayran', price: '30.999' }] },
    ],
    [
      'non-boolean item availability',
      {
        name: 'Drinks',
        items: [{ name: 'Ayran', price: '30.00', isAvailable: 'yes' }],
      },
    ],
    [
      'owner-managed sort field',
      {
        name: 'Drinks',
        items: [{ name: 'Ayran', price: '30.00' }],
        sortOrder: 1,
      },
    ],
  ] as const)(
    'rejects invalid add-on group create payloads with %s',
    async (_label, body) => {
      await insertTenant();

      await expect(createMenuAddOnGroup('tenant-1', body)).resolves.toEqual({
        ok: false,
        errorCode: 'INVALID_MENU_ADD_ON_GROUP_REQUEST',
      });
    }
  );

  it.each([
    [
      'missing item availability',
      { name: 'Drinks', items: [{ name: 'Ayran', price: '30.00' }] },
    ],
    [
      'duplicate item names',
      {
        name: 'Drinks',
        items: [
          { name: 'Ayran', price: '30.00', isAvailable: true },
          { name: ' ayran ', price: '35.00', isAvailable: true },
        ],
      },
    ],
    [
      'owner-managed item id',
      {
        name: 'Drinks',
        items: [
          {
            id: 'add-on-item-1',
            name: 'Ayran',
            price: '30.00',
            isAvailable: true,
          },
        ],
      },
    ],
  ] as const)(
    'rejects invalid add-on group update payloads with %s',
    async (_label, body) => {
      await insertTenant();

      await expect(
        updateMenuAddOnGroup('tenant-1', 'add-on-group-1', body)
      ).resolves.toEqual({
        ok: false,
        errorCode: 'INVALID_MENU_ADD_ON_GROUP_REQUEST',
      });
    }
  );
});
