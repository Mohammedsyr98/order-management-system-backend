import 'dotenv/config';
import { beforeEach, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for menu-category-service.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { insertTenant, resetTenantTestData } =
  await import('../../test/test-db.js');
const { insertMenuCategory } = await import('./test-support.js');
const {
  createMenuCategory,
  deleteMenuCategory,
  listMenuCategories,
  updateMenuCategory,
} = await import('../menu-service.js');

const categoryResponse = ({
  id,
  tenantId = 'tenant-1',
  name,
}: {
  id: string;
  tenantId?: string;
  name: string;
}) => ({
  id,
  tenantId,
  name,
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
  products: [],
});

describe('menu category service', () => {
  beforeEach(async () => {
    await resetTenantTestData();
  });

  it('creates, lists, updates, and hard-deletes a category in a tenant', async () => {
    await insertTenant();

    const created = await createMenuCategory('tenant-1', { name: ' Mains ' });

    expect(created).toEqual({
      ok: true,
      data: {
        category: {
          id: expect.any(String),
          tenantId: 'tenant-1',
          name: 'Mains',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          products: [],
        },
      },
    });

    if (!created.ok) {
      throw new Error('Expected category creation to succeed.');
    }

    const categoryId = created.data.category.id;

    await expect(listMenuCategories('tenant-1')).resolves.toEqual({
      ok: true,
      data: {
        categories: [categoryResponse({ id: categoryId, name: 'Mains' })],
      },
    });

    await expect(
      updateMenuCategory('tenant-1', categoryId, { name: ' Specials ' })
    ).resolves.toEqual({
      ok: true,
      data: {
        category: categoryResponse({ id: categoryId, name: 'Specials' }),
      },
    });

    await expect(deleteMenuCategory('tenant-1', categoryId)).resolves.toEqual({
      ok: true,
    });

    await expect(listMenuCategories('tenant-1')).resolves.toEqual({
      ok: true,
      data: { categories: [] },
    });
  });

  it('lists only categories in the requested tenant in stable creation order', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertMenuCategory({
      id: 'category-2',
      name: 'Desserts',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await insertMenuCategory({
      id: 'category-1',
      name: 'Mains',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await insertMenuCategory({
      id: 'category-3',
      tenantId: 'tenant-2',
      name: 'Mains',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    await expect(listMenuCategories('tenant-1')).resolves.toEqual({
      ok: true,
      data: {
        categories: [
          categoryResponse({ id: 'category-1', name: 'Mains' }),
          categoryResponse({ id: 'category-2', name: 'Desserts' }),
        ],
      },
    });
  });

  it('rejects duplicate category names within a tenant and allows them across tenants', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertMenuCategory({ id: 'category-1', name: 'Mains' });

    await expect(
      createMenuCategory('tenant-1', { name: 'mains' })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_CATEGORY_NAME_ALREADY_EXISTS',
    });

    await expect(
      createMenuCategory('tenant-2', { name: 'mains' })
    ).resolves.toMatchObject({
      ok: true,
      data: {
        category: {
          tenantId: 'tenant-2',
          name: 'mains',
        },
      },
    });
  });

  it('rejects duplicate category names on update within a tenant', async () => {
    await insertTenant();
    await insertMenuCategory({ id: 'category-1', name: 'Mains' });
    await insertMenuCategory({ id: 'category-2', name: 'Desserts' });

    await expect(
      updateMenuCategory('tenant-1', 'category-2', { name: 'mains' })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_CATEGORY_NAME_ALREADY_EXISTS',
    });
  });

  it('returns not found when updating or deleting another tenant category', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertMenuCategory({
      id: 'other-tenant-category-1',
      tenantId: 'tenant-2',
      name: 'Mains',
    });

    await expect(
      updateMenuCategory('tenant-1', 'other-tenant-category-1', {
        name: 'Renamed',
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_CATEGORY_NOT_FOUND',
    });

    await expect(
      deleteMenuCategory('tenant-1', 'other-tenant-category-1')
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_CATEGORY_NOT_FOUND',
    });
  });

  it.each([
    ['missing name', {}],
    ['blank name', { name: '   ' }],
    ['non-string name', { name: 123 }],
    ['owner-managed sort field', { name: 'Mains', sortOrder: 1 }],
  ] as const)(
    'rejects invalid category create payloads with %s',
    async (_label, body) => {
      await insertTenant();

      await expect(createMenuCategory('tenant-1', body)).resolves.toEqual({
        ok: false,
        errorCode: 'INVALID_MENU_CATEGORY_REQUEST',
      });
    }
  );

  it.each([
    ['missing name', {}],
    ['blank name', { name: '   ' }],
    ['non-string name', { name: 123 }],
    ['owner-managed sort field', { name: 'Mains', sortOrder: 1 }],
  ] as const)(
    'rejects invalid category update payloads with %s',
    async (_label, body) => {
      await insertTenant();

      await expect(
        updateMenuCategory('tenant-1', 'category-1', body)
      ).resolves.toEqual({
        ok: false,
        errorCode: 'INVALID_MENU_CATEGORY_REQUEST',
      });
    }
  );
});
