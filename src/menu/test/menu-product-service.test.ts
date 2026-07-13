import 'dotenv/config';
import { beforeEach, describe, expect, it } from 'vitest';

import type { MenuProduct } from '../../contracts/menu.js';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST is required for menu-product-service.test.ts'
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

const { insertTenant, resetTenantTestData } =
  await import('../../test/test-db.js');
const {
  insertMenuAddOnGroup,
  insertMenuAddOnItem,
  insertMenuCategory,
  insertMenuProduct,
  insertMenuProductAddOnGroup,
  insertMenuProductPricingChoice,
} = await import('./test-support.js');
const {
  createMenuProduct,
  createFixedPriceProduct,
  deleteMenuAddOnGroup,
  deleteFixedPriceProduct,
  listMenuAddOnGroups,
  listMenuCategories,
  updateMenuProduct,
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
  pricingMode: 'fixed',
  pricing: {
    price,
  },
  addOnGroups: [],
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
});

const choiceProductResponse = ({
  id,
  categoryId = 'category-1',
  name,
  description,
  isAvailable,
  choices,
}: {
  id: string;
  categoryId?: string;
  name: string;
  description: string | null;
  isAvailable: boolean;
  choices: Array<{
    id: string;
    name: string;
    price: string;
    isAvailable: boolean;
  }>;
}) => ({
  id,
  categoryId,
  name,
  description,
  isAvailable,
  pricingMode: 'priced_by_choice',
  pricing: {
    choices: choices.map((choice) => ({
      ...choice,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })),
  },
  addOnGroups: [],
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
});

const expectChoicePricedProduct = (product: MenuProduct) => {
  expect(product.pricingMode).toBe('priced_by_choice');

  if (product.pricingMode !== 'priced_by_choice') {
    throw new Error('Expected a choice-priced product.');
  }

  return product;
};

describe('fixed-price product service', () => {
  beforeEach(async () => {
    await resetTenantTestData();
  });

  it('attaches reusable add-on groups when creating and listing a product', async () => {
    await insertTenant();
    await insertMenuCategory({ id: 'category-1', name: 'Mains' });
    await insertMenuAddOnGroup({ id: 'drinks-group', name: 'Drinks' });
    await insertMenuAddOnItem({
      id: 'ayran-item',
      groupId: 'drinks-group',
      name: 'Ayran',
      priceMinorUnits: 3075,
    });

    const created = await createMenuProduct('tenant-1', 'category-1', {
      name: 'Doner',
      description: 'Beef doner',
      price: '120.00',
      addOnGroupIds: ['drinks-group'],
    });

    const attachedGroup = {
      id: 'drinks-group',
      tenantId: 'tenant-1',
      name: 'Drinks',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      items: [
        {
          id: 'ayran-item',
          groupId: 'drinks-group',
          name: 'Ayran',
          price: '30.75',
          isAvailable: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ],
    };
    const product = {
      id: expect.any(String),
      categoryId: 'category-1',
      name: 'Doner',
      description: 'Beef doner',
      isAvailable: true,
      pricingMode: 'fixed',
      pricing: { price: '120.00' },
      addOnGroups: [attachedGroup],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    };

    expect(created).toEqual({ ok: true, data: { product } });

    await expect(listMenuCategories('tenant-1')).resolves.toEqual({
      ok: true,
      data: {
        categories: [
          {
            id: 'category-1',
            tenantId: 'tenant-1',
            name: 'Mains',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            products: [product],
          },
        ],
      },
    });
  });

  it('fully replaces product add-on attachments without changing reusable groups', async () => {
    await insertTenant();
    await insertMenuCategory({ id: 'category-1', name: 'Mains' });
    await insertMenuProduct({ id: 'product-1', name: 'Doner' });
    await insertMenuAddOnGroup({ id: 'drinks-group', name: 'Drinks' });
    await insertMenuAddOnItem({
      id: 'ayran-item',
      groupId: 'drinks-group',
      name: 'Ayran',
    });
    await insertMenuAddOnGroup({ id: 'extras-group', name: 'Extras' });
    await insertMenuAddOnItem({
      id: 'cheese-item',
      groupId: 'extras-group',
      name: 'Cheese',
      priceMinorUnits: 1500,
    });
    await insertMenuProductAddOnGroup({
      productId: 'product-1',
      addOnGroupId: 'drinks-group',
    });

    const updated = await updateMenuProduct('tenant-1', 'product-1', {
      name: 'Doner',
      description: null,
      isAvailable: true,
      price: '30.00',
      addOnGroupIds: ['extras-group'],
    });

    expect(updated).toMatchObject({
      ok: true,
      data: {
        product: {
          id: 'product-1',
          addOnGroups: [
            {
              id: 'extras-group',
              name: 'Extras',
              items: [
                {
                  id: 'cheese-item',
                  name: 'Cheese',
                  price: '15.00',
                  isAvailable: true,
                },
              ],
            },
          ],
        },
      },
    });

    const listed = await listMenuCategories('tenant-1');
    expect(listed.data.categories[0]?.products[0]?.addOnGroups).toMatchObject([
      { id: 'extras-group' },
    ]);

    const reusableGroups = await listMenuAddOnGroups('tenant-1');
    expect(reusableGroups.data.addOnGroups).toHaveLength(2);
    expect(reusableGroups.data.addOnGroups.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['drinks-group', 'extras-group'])
    );
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
        product: productResponse({
          id: expect.any(String),
          name: 'Ayran',
          description: 'Cold yogurt drink',
          isAvailable: false,
          price: '30.70',
        }),
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
        addOnGroupIds: [],
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

  it('creates and lists a choice-priced product with normalized choice prices', async () => {
    await insertTenant();
    await insertMenuCategory({ id: 'category-1', name: 'Mains' });

    const created = await createMenuProduct('tenant-1', 'category-1', {
      name: ' Doner ',
      description: ' Beef doner ',
      pricingMode: 'priced_by_choice',
      pricing: {
        choices: [
          { name: ' Yarim ', price: '80', isAvailable: true },
          { name: 'Tam', price: '140.5', isAvailable: false },
        ],
      },
    });

    expect(created).toEqual({
      ok: true,
      data: {
        product: choiceProductResponse({
          id: expect.any(String),
          name: 'Doner',
          description: 'Beef doner',
          isAvailable: true,
          choices: [
            {
              id: expect.any(String),
              name: 'Yarim',
              price: '80.00',
              isAvailable: true,
            },
            {
              id: expect.any(String),
              name: 'Tam',
              price: '140.50',
              isAvailable: false,
            },
          ],
        }),
      },
    });

    if (!created.ok) {
      throw new Error('Expected product creation to succeed.');
    }

    const createdProduct = expectChoicePricedProduct(created.data.product);

    await expect(listMenuCategories('tenant-1')).resolves.toEqual({
      ok: true,
      data: {
        categories: [
          {
            id: 'category-1',
            tenantId: 'tenant-1',
            name: 'Mains',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            products: [
              choiceProductResponse({
                id: createdProduct.id,
                name: 'Doner',
                description: 'Beef doner',
                isAvailable: true,
                choices: createdProduct.pricing.choices,
              }),
            ],
          },
        ],
      },
    });
  });

  it('creates a choice-priced product with complete attached add-on context', async () => {
    await insertTenant();
    await insertMenuCategory({ id: 'category-1', name: 'Mains' });
    await insertMenuAddOnGroup({ id: 'sauces-group', name: 'Sauces' });
    await insertMenuAddOnItem({
      id: 'garlic-sauce-item',
      groupId: 'sauces-group',
      name: 'Garlic sauce',
      isAvailable: false,
      priceMinorUnits: 500,
    });

    const created = await createMenuProduct('tenant-1', 'category-1', {
      name: 'Doner',
      description: 'Beef doner',
      pricingMode: 'priced_by_choice',
      pricing: {
        choices: [{ name: 'Tam', price: '140.00', isAvailable: true }],
      },
      addOnGroupIds: ['sauces-group'],
    });

    expect(created).toMatchObject({
      ok: true,
      data: {
        product: {
          name: 'Doner',
          pricingMode: 'priced_by_choice',
          pricing: {
            choices: [{ name: 'Tam', price: '140.00', isAvailable: true }],
          },
          addOnGroups: [
            {
              id: 'sauces-group',
              name: 'Sauces',
              items: [
                {
                  id: 'garlic-sauce-item',
                  name: 'Garlic sauce',
                  price: '5.00',
                  isAvailable: false,
                },
              ],
            },
          ],
        },
      },
    });

    const listed = await listMenuCategories('tenant-1');
    expect(listed.data.categories[0]?.products[0]).toMatchObject(
      created.ok ? created.data.product : {}
    );
  });

  it('fully replaces a choice-priced product pricing configuration on update', async () => {
    await insertTenant();
    await insertMenuCategory({ id: 'category-1', name: 'Mains' });

    const created = await createMenuProduct('tenant-1', 'category-1', {
      name: 'Doner',
      pricingMode: 'priced_by_choice',
      pricing: {
        choices: [
          { name: 'Yarim', price: '80.00', isAvailable: true },
          { name: 'Tam', price: '140.00', isAvailable: true },
        ],
      },
      addOnGroupIds: [],
    });

    if (!created.ok) {
      throw new Error('Expected product creation to succeed.');
    }

    const createdProduct = expectChoicePricedProduct(created.data.product);

    const updated = await updateMenuProduct('tenant-1', createdProduct.id, {
      name: 'Special Doner',
      description: null,
      isAvailable: false,
      pricingMode: 'priced_by_choice',
      pricing: {
        choices: [
          { name: 'Single', price: '90', isAvailable: true },
          { name: 'Double', price: '160.75', isAvailable: false },
        ],
      },
      addOnGroupIds: [],
    });

    expect(updated).toEqual({
      ok: true,
      data: {
        product: choiceProductResponse({
          id: createdProduct.id,
          name: 'Special Doner',
          description: null,
          isAvailable: false,
          choices: [
            {
              id: expect.any(String),
              name: 'Single',
              price: '90.00',
              isAvailable: true,
            },
            {
              id: expect.any(String),
              name: 'Double',
              price: '160.75',
              isAvailable: false,
            },
          ],
        }),
      },
    });

    if (!updated.ok) {
      throw new Error('Expected product update to succeed.');
    }

    const updatedProduct = expectChoicePricedProduct(updated.data.product);

    await expect(listMenuCategories('tenant-1')).resolves.toEqual({
      ok: true,
      data: {
        categories: [
          {
            id: 'category-1',
            tenantId: 'tenant-1',
            name: 'Mains',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
            products: [
              choiceProductResponse({
                id: createdProduct.id,
                name: 'Special Doner',
                description: null,
                isAvailable: false,
                choices: updatedProduct.pricing.choices,
              }),
            ],
          },
        ],
      },
    });

    const originalChoiceIds = new Set(
      createdProduct.pricing.choices.map((choice) => choice.id)
    );

    expect(
      updatedProduct.pricing.choices.some((choice) =>
        originalChoiceIds.has(choice.id)
      )
    ).toBe(false);
  });

  it('replaces choice-priced product choices and add-on attachments together', async () => {
    await insertTenant();
    await insertMenuCategory({ id: 'category-1', name: 'Mains' });
    await insertMenuProduct({
      id: 'product-1',
      name: 'Doner',
      pricingMode: 'priced_by_choice',
      priceMinorUnits: null,
    });
    await insertMenuProductPricingChoice({
      id: 'old-choice',
      productId: 'product-1',
      name: 'Regular',
    });
    await insertMenuAddOnGroup({ id: 'drinks-group', name: 'Drinks' });
    await insertMenuAddOnGroup({ id: 'sauces-group', name: 'Sauces' });
    await insertMenuAddOnItem({
      id: 'garlic-sauce-item',
      groupId: 'sauces-group',
      name: 'Garlic sauce',
    });
    await insertMenuProductAddOnGroup({
      productId: 'product-1',
      addOnGroupId: 'drinks-group',
    });

    const updated = await updateMenuProduct('tenant-1', 'product-1', {
      name: 'Doner',
      description: null,
      isAvailable: true,
      pricingMode: 'priced_by_choice',
      pricing: {
        choices: [{ name: 'Large', price: '160.00', isAvailable: true }],
      },
      addOnGroupIds: ['sauces-group'],
    });

    expect(updated).toMatchObject({
      ok: true,
      data: {
        product: {
          pricing: { choices: [{ name: 'Large', price: '160.00' }] },
          addOnGroups: [
            {
              id: 'sauces-group',
              items: [{ id: 'garlic-sauce-item', name: 'Garlic sauce' }],
            },
          ],
        },
      },
    });

    const listed = await listMenuCategories('tenant-1');
    expect(listed.data.categories[0]?.products[0]).toMatchObject(
      updated.ok ? updated.data.product : {}
    );
  });

  it('rejects missing, deleted, and foreign-tenant add-on group attachments', async () => {
    await insertTenant();
    await insertTenant({ id: 'tenant-2', name: 'Second Tenant' });
    await insertMenuCategory({ id: 'category-1', name: 'Mains' });
    await insertMenuAddOnGroup({ id: 'drinks-group', name: 'Drinks' });
    await insertMenuAddOnGroup({
      id: 'foreign-group',
      tenantId: 'tenant-2',
      name: 'Foreign Drinks',
    });

    for (const addOnGroupId of ['missing-group', 'foreign-group']) {
      await expect(
        createMenuProduct('tenant-1', 'category-1', {
          name: `Doner ${addOnGroupId}`,
          description: null,
          price: '120.00',
          addOnGroupIds: [addOnGroupId],
        })
      ).resolves.toEqual({
        ok: false,
        errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND',
      });
    }

    await expect(
      deleteMenuAddOnGroup('tenant-1', 'drinks-group')
    ).resolves.toEqual({ ok: true });
    await expect(
      createMenuProduct('tenant-1', 'category-1', {
        name: 'Deleted group product',
        description: null,
        price: '120.00',
        addOnGroupIds: ['drinks-group'],
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND',
    });

    await insertMenuAddOnGroup({ id: 'extras-group', name: 'Extras' });
    await insertMenuProduct({ id: 'product-1', name: 'Doner' });
    await insertMenuProductAddOnGroup({
      productId: 'product-1',
      addOnGroupId: 'extras-group',
    });
    await expect(
      updateMenuProduct('tenant-1', 'product-1', {
        name: 'Doner',
        description: null,
        isAvailable: true,
        price: '120.00',
        addOnGroupIds: ['foreign-group'],
      })
    ).resolves.toEqual({
      ok: false,
      errorCode: 'MENU_ADD_ON_GROUP_NOT_FOUND',
    });

    const listed = await listMenuCategories('tenant-1');
    expect(listed.data.categories[0]?.products[0]?.addOnGroups).toMatchObject([
      { id: 'extras-group' },
    ]);
  });

  it('removes deleted add-on groups from product responses without changing the product', async () => {
    await insertTenant();
    await insertMenuCategory({ id: 'category-1', name: 'Mains' });
    await insertMenuProduct({
      id: 'product-1',
      name: 'Doner',
      description: 'Beef doner',
      isAvailable: false,
      priceMinorUnits: 12000,
    });
    await insertMenuAddOnGroup({ id: 'drinks-group', name: 'Drinks' });
    await insertMenuAddOnItem({
      id: 'ayran-item',
      groupId: 'drinks-group',
      name: 'Ayran',
    });
    await insertMenuProductAddOnGroup({
      productId: 'product-1',
      addOnGroupId: 'drinks-group',
    });

    await expect(
      deleteMenuAddOnGroup('tenant-1', 'drinks-group')
    ).resolves.toEqual({ ok: true });

    const listed = await listMenuCategories('tenant-1');
    expect(listed.data.categories[0]?.products).toMatchObject([
      {
        id: 'product-1',
        name: 'Doner',
        description: 'Beef doner',
        isAvailable: false,
        pricing: { price: '120.00' },
        addOnGroups: [],
      },
    ]);
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
          pricingMode: 'fixed',
          pricing: {
            price: '10.00',
          },
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
        addOnGroupIds: [],
      })
    ).resolves.toMatchObject({
      ok: true,
      data: {
        product: {
          name: 'Still Water',
          description: null,
          isAvailable: true,
          pricingMode: 'fixed',
          pricing: {
            price: '10.50',
          },
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
    await insertMenuProduct({
      id: 'other-tenant-product-2',
      categoryId: 'category-3',
      name: 'Doner',
      pricingMode: 'priced_by_choice',
      priceMinorUnits: null,
      createdAt: new Date('2025-01-02T00:00:00.000Z'),
      updatedAt: new Date('2025-01-02T00:00:00.000Z'),
    });
    await insertMenuProductPricingChoice({
      id: 'other-tenant-choice-1',
      productId: 'other-tenant-product-2',
      name: 'Tam',
      priceMinorUnits: 14000,
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

  it('lists attached groups and items in stable creation order', async () => {
    await insertTenant();
    await insertMenuCategory({ id: 'category-1', name: 'Mains' });
    await insertMenuProduct({ id: 'product-1', name: 'Doner' });
    await insertMenuAddOnGroup({
      id: 'group-2',
      name: 'Extras',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await insertMenuAddOnGroup({
      id: 'group-1',
      name: 'Sauces',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await insertMenuAddOnItem({
      id: 'item-2',
      groupId: 'group-1',
      name: 'Hot sauce',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await insertMenuAddOnItem({
      id: 'item-1',
      groupId: 'group-1',
      name: 'Garlic sauce',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await insertMenuProductAddOnGroup({
      productId: 'product-1',
      addOnGroupId: 'group-2',
    });
    await insertMenuProductAddOnGroup({
      productId: 'product-1',
      addOnGroupId: 'group-1',
    });

    const listed = await listMenuCategories('tenant-1');
    const groups = listed.data.categories[0]?.products[0]?.addOnGroups;

    expect(groups?.map(({ id }) => id)).toEqual(['group-1', 'group-2']);
    expect(groups?.[0]?.items.map(({ id }) => id)).toEqual([
      'item-1',
      'item-2',
    ]);
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
      createMenuProduct('tenant-1', 'category-1', {
        name: 'ayran',
        pricingMode: 'priced_by_choice',
        pricing: {
          choices: [{ name: 'Tam', price: '140.00', isAvailable: true }],
        },
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
        addOnGroupIds: [],
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
        addOnGroupIds: [],
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
        addOnGroupIds: [],
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
    [
      'duplicate add-on group IDs',
      {
        name: 'Ayran',
        price: '30.00',
        addOnGroupIds: ['drinks-group', 'drinks-group'],
      },
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
    [
      'missing choices',
      {
        name: 'Doner',
        pricingMode: 'priced_by_choice',
        pricing: {},
      },
    ],
    [
      'empty choices',
      {
        name: 'Doner',
        pricingMode: 'priced_by_choice',
        pricing: { choices: [] },
      },
    ],
    [
      'blank choice name',
      {
        name: 'Doner',
        pricingMode: 'priced_by_choice',
        pricing: {
          choices: [{ name: '   ', price: '80.00', isAvailable: true }],
        },
      },
    ],
    [
      'duplicate choice names',
      {
        name: 'Doner',
        pricingMode: 'priced_by_choice',
        pricing: {
          choices: [
            { name: 'Tam', price: '140.00', isAvailable: true },
            { name: ' tam ', price: '150.00', isAvailable: true },
          ],
        },
      },
    ],
    [
      'invalid choice price',
      {
        name: 'Doner',
        pricingMode: 'priced_by_choice',
        pricing: {
          choices: [{ name: 'Tam', price: '140.999', isAvailable: true }],
        },
      },
    ],
    [
      'malformed pricing mode',
      {
        name: 'Doner',
        pricingMode: 'by_choice',
        pricing: {
          choices: [{ name: 'Tam', price: '140.00', isAvailable: true }],
        },
      },
    ],
    [
      'mixed fixed and choice pricing',
      {
        name: 'Doner',
        price: '100.00',
        pricingMode: 'priced_by_choice',
        pricing: {
          choices: [{ name: 'Tam', price: '140.00', isAvailable: true }],
        },
      },
    ],
  ] as const)(
    'rejects invalid choice-priced product create payloads with %s',
    async (_label, body) => {
      await insertTenant();
      await insertMenuCategory({ id: 'category-1', name: 'Mains' });

      await expect(
        createMenuProduct('tenant-1', 'category-1', body)
      ).resolves.toEqual({
        ok: false,
        errorCode: 'INVALID_MENU_PRODUCT_REQUEST',
      });
    }
  );

  it.each([
    [
      'missing name',
      {
        description: null,
        isAvailable: true,
        price: '30.00',
        addOnGroupIds: [],
      },
    ],
    [
      'missing availability',
      {
        name: 'Ayran',
        description: null,
        price: '30.00',
        addOnGroupIds: [],
      },
    ],
    [
      'missing add-on attachments',
      {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        price: '30.00',
      },
    ],
    [
      'missing price',
      {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        addOnGroupIds: [],
      },
    ],
    [
      'price with more than two decimals',
      {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        price: '30.999',
        addOnGroupIds: [],
      },
    ],
    [
      'owner-managed category change',
      {
        name: 'Ayran',
        description: null,
        isAvailable: true,
        price: '30.00',
        addOnGroupIds: [],
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

  it.each([
    [
      'missing choice availability',
      {
        name: 'Doner',
        description: null,
        isAvailable: true,
        pricingMode: 'priced_by_choice',
        pricing: {
          choices: [{ name: 'Tam', price: '140.00' }],
        },
        addOnGroupIds: [],
      },
    ],
    [
      'mixed fixed and choice pricing',
      {
        name: 'Doner',
        description: null,
        isAvailable: true,
        price: '100.00',
        pricingMode: 'priced_by_choice',
        pricing: {
          choices: [{ name: 'Tam', price: '140.00', isAvailable: true }],
        },
        addOnGroupIds: [],
      },
    ],
  ] as const)(
    'rejects invalid choice-priced product update payloads with %s',
    async (_label, body) => {
      await insertTenant();
      await insertMenuCategory({ id: 'category-1', name: 'Mains' });

      await expect(
        updateMenuProduct('tenant-1', 'product-1', body)
      ).resolves.toEqual({
        ok: false,
        errorCode: 'INVALID_MENU_PRODUCT_REQUEST',
      });
    }
  );
});
