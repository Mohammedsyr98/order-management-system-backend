import 'dotenv/config';
import { beforeEach, describe, expect, it } from 'vitest';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for menu-product-service.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { insertTenant, resetTenantTestData } =
  await import('../../test/test-db.js');
const { insertMenuCategory, insertMenuProduct } =
  await import('./test-support.js');
const {
  createFixedPriceProduct,
  deleteFixedPriceProduct,
  listMenuCategories,
  updateFixedPriceProduct,
} = await import('../menu-service.js');

const productResponse = ({
  id,
  categoryId = 'category-1',
  name,
  description,
  isAvailable,
  price,
}: {
  id: string;
  categoryId?: string;
  name: string;
  description: string | null;
  isAvailable: boolean;
  price: string;
}) => ({
  id,
  categoryId,
  name,
  description,
  isAvailable,
  price,
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
});

describe('fixed-price product service', () => {
  beforeEach(async () => {
    await resetTenantTestData();
  });

  it('creates, lists, updates, and hard-deletes a fixed-price product in a category', async () => {
    await insertTenant();
    await insertMenuCategory({ id: 'category-1', name: 'Drinks' });

    const created = await createFixedPriceProduct('tenant-1', 'category-1', {
      name: ' Ayran ',
      description: ' Cold yogurt drink ',
      isAvailable: false,
      price: '30.7',
    });

    expect(created).toEqual({
      ok: true,
      data: {
        product: {
          id: expect.any(String),
          categoryId: 'category-1',
          name: 'Ayran',
          description: 'Cold yogurt drink',
          isAvailable: false,
          price: '30.70',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      },
    });

    if (!created.ok) {
      throw new Error('Expected product creation to succeed.');
    }

    const productId = created.data.product.id;

    await expect(listMenuCategories('tenant-1')).resolves.toEqual({
      ok: true,
      data: {
        categories: [
          {
            id: 'category-1',
            tenantId: 'tenant-1',
            name: 'Drinks',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            products: [
              productResponse({
                id: productId,
                name: 'Ayran',
                description: 'Cold yogurt drink',
                isAvailable: false,
                price: '30.70',
              }),
            ],
          },
        ],
      },
    });

    await expect(
      updateFixedPriceProduct('tenant-1', productId, {
        name: 'Fresh Ayran',
        description: null,
        isAvailable: true,
        price: '31',
      })
    ).resolves.toEqual({
      ok: true,
      data: {
        product: productResponse({
          id: productId,
          name: 'Fresh Ayran',
          description: null,
          isAvailable: true,
          price: '31.00',
        }),
      },
    });

    await expect(
      deleteFixedPriceProduct('tenant-1', productId)
    ).resolves.toEqual({ ok: true });

    await expect(listMenuCategories('tenant-1')).resolves.toEqual({
      ok: true,
      data: {
        categories: [
          {
            id: 'category-1',
            tenantId: 'tenant-1',
            name: 'Drinks',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            products: [],
          },
        ],
      },
    });
  });

  it('defaults availability and normalizes omitted or blank descriptions to null', async () => {
    await insertTenant();
    await insertMenuCategory({ id: 'category-1', name: 'Drinks' });

    const created = await createFixedPriceProduct('tenant-1', 'category-1', {
      name: 'Water',
      description: '   ',
      price: '10',
    });

    expect(created).toMatchObject({
      ok: true,
      data: {
        product: {
          name: 'Water',
          description: null,
          isAvailable: true,
          price: '10.00',
        },
      },
    });

    if (!created.ok) {
      throw new Error('Expected product creation to succeed.');
    }

    await expect(
      updateFixedPriceProduct('tenant-1', created.data.product.id, {
        name: 'Still Water',
        description: '   ',
        isAvailable: true,
        price: '10.5',
      })
    ).resolves.toMatchObject({
      ok: true,
      data: {
        product: {
          name: 'Still Water',
          description: null,
          isAvailable: true,
          price: '10.50',
        },
      },
    });
  });

  it('lists products inside their categories in stable order and isolates other tenant data', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertMenuCategory({
      id: 'category-1',
      name: 'Drinks',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await insertMenuCategory({
      id: 'category-2',
      name: 'Desserts',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await insertMenuCategory({
      id: 'category-3',
      tenantId: 'tenant-2',
      name: 'Drinks',
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    });
    await insertMenuProduct({
      id: 'product-2',
      categoryId: 'category-1',
      name: 'Water',
      priceMinorUnits: 1000,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await insertMenuProduct({
      id: 'product-1',
      categoryId: 'category-1',
      name: 'Ayran',
      description: 'Cold yogurt drink',
      isAvailable: false,
      priceMinorUnits: 3075,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await insertMenuProduct({
      id: 'other-tenant-product-1',
      categoryId: 'category-3',
      name: 'Ayran',
      priceMinorUnits: 3000,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    await expect(listMenuCategories('tenant-1')).resolves.toEqual({
      ok: true,
      data: {
        categories: [
          {
            id: 'category-1',
            tenantId: 'tenant-1',
            name: 'Drinks',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            products: [
              productResponse({
                id: 'product-1',
                name: 'Ayran',
                description: 'Cold yogurt drink',
                isAvailable: false,
                price: '30.75',
              }),
              productResponse({
                id: 'product-2',
                name: 'Water',
                description: null,
                isAvailable: true,
                price: '10.00',
              }),
            ],
          },
          {
            id: 'category-2',
            tenantId: 'tenant-1',
            name: 'Desserts',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            products: [],
          },
        ],
      },
    });
  });

  it('rejects duplicate product names within a category and allows reuse across categories and tenants', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertMenuCategory({ id: 'category-1', name: 'Drinks' });
    await insertMenuCategory({ id: 'category-2', name: 'Desserts' });
    await insertMenuCategory({
      id: 'other-tenant-category-1',
      tenantId: 'tenant-2',
      name: 'Drinks',
    });
    await insertMenuProduct({
      id: 'product-1',
      categoryId: 'category-1',
      name: 'Ayran',
    });
    await insertMenuProduct({
      id: 'product-2',
      categoryId: 'category-1',
      name: 'Water',
    });

    await expect(
      createFixedPriceProduct('tenant-1', 'category-1', {
        name: 'ayran',
        price: '30.00',
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_PRODUCT_NAME_ALREADY_EXISTS',
    });

    await expect(
      updateFixedPriceProduct('tenant-1', 'product-2', {
        name: 'ayran',
        description: null,
        isAvailable: true,
        price: '10.00',
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_PRODUCT_NAME_ALREADY_EXISTS',
    });

    await expect(
      createFixedPriceProduct('tenant-1', 'category-2', {
        name: 'ayran',
        price: '30.00',
      })
    ).resolves.toMatchObject({
      ok: true,
      data: {
        product: {
          categoryId: 'category-2',
          name: 'ayran',
        },
      },
    });

    await expect(
      createFixedPriceProduct('tenant-2', 'other-tenant-category-1', {
        name: 'ayran',
        price: '30.00',
      })
    ).resolves.toMatchObject({
      ok: true,
      data: {
        product: {
          categoryId: 'other-tenant-category-1',
          name: 'ayran',
        },
      },
    });
  });

  it('returns not found when creating in a missing or other-tenant category', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertMenuCategory({
      id: 'other-tenant-category-1',
      tenantId: 'tenant-2',
      name: 'Drinks',
    });

    await expect(
      createFixedPriceProduct('tenant-1', 'missing-category', {
        name: 'Ayran',
        price: '30.00',
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_CATEGORY_NOT_FOUND',
    });

    await expect(
      createFixedPriceProduct('tenant-1', 'other-tenant-category-1', {
        name: 'Ayran',
        price: '30.00',
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_CATEGORY_NOT_FOUND',
    });
  });

  it('returns not found when updating or deleting missing or other-tenant products', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertMenuCategory({
      id: 'other-tenant-category-1',
      tenantId: 'tenant-2',
      name: 'Drinks',
    });
    await insertMenuProduct({
      id: 'other-tenant-product-1',
      categoryId: 'other-tenant-category-1',
      name: 'Ayran',
    });

    await expect(
      updateFixedPriceProduct('tenant-1', 'missing-product', {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        price: '30.00',
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_PRODUCT_NOT_FOUND',
    });

    await expect(
      updateFixedPriceProduct('tenant-1', 'other-tenant-product-1', {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        price: '30.00',
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_PRODUCT_NOT_FOUND',
    });

    await expect(
      deleteFixedPriceProduct('tenant-1', 'missing-product')
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_PRODUCT_NOT_FOUND',
    });

    await expect(
      deleteFixedPriceProduct('tenant-1', 'other-tenant-product-1')
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_PRODUCT_NOT_FOUND',
    });
  });

  it.each([
    ['missing name', { price: '30.00' }],
    ['blank name', { name: '   ', price: '30.00' }],
    ['missing price', { name: 'Ayran' }],
    ['malformed price', { name: 'Ayran', price: 'abc' }],
    ['negative price', { name: 'Ayran', price: '-1.00' }],
    ['price with more than two decimals', { name: 'Ayran', price: '30.999' }],
    ['non-string price', { name: 'Ayran', price: 30 }],
    [
      'non-boolean availability',
      { name: 'Ayran', isAvailable: 'yes', price: '30.00' },
    ],
    [
      'owner-managed sort field',
      { name: 'Ayran', price: '30.00', sortOrder: 1 },
    ],
  ] as const)(
    'rejects invalid product create payloads with %s',
    async (_label, body) => {
      await insertTenant();
      await insertMenuCategory({ id: 'category-1', name: 'Drinks' });

      await expect(
        createFixedPriceProduct('tenant-1', 'category-1', body)
      ).resolves.toEqual({
        ok: false,
        errorCode: 'INVALID_MENU_PRODUCT_REQUEST',
      });
    }
  );

  it.each([
    ['missing name', { description: null, isAvailable: true, price: '30.00' }],
    [
      'missing availability',
      { name: 'Ayran', description: null, price: '30.00' },
    ],
    ['missing price', { name: 'Ayran', description: null, isAvailable: true }],
    [
      'price with more than two decimals',
      {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        price: '30.999',
      },
    ],
    [
      'owner-managed category change',
      {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        price: '30.00',
        categoryId: 'category-2',
      },
    ],
  ] as const)(
    'rejects invalid product update payloads with %s',
    async (_label, body) => {
      await insertTenant();
      await insertMenuCategory({ id: 'category-1', name: 'Drinks' });

      await expect(
        updateFixedPriceProduct('tenant-1', 'product-1', body)
      ).resolves.toEqual({
        ok: false,
        errorCode: 'INVALID_MENU_PRODUCT_REQUEST',
      });
    }
  );
});
