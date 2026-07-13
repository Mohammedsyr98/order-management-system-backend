import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import {
  defaultOperatingHours,
  defaultTenantTimezone,
  type OperatingHours,
} from '../contracts/tenant.js';

export const user = pgTable('auth_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const session = pgTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('auth_sessions_user_id_idx').on(table.userId)]
);

export const account = pgTable(
  'auth_accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('auth_accounts_user_id_idx').on(table.userId)]
);

export const verification = pgTable(
  'auth_verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('auth_verifications_identifier_idx').on(table.identifier)]
);

export const tenantRole = pgEnum('tenant_role', [
  'owner',
  'manager',
  'courier',
]);

export const menuProductPricingMode = pgEnum('menu_product_pricing_mode', [
  'fixed',
  'priced_by_choice',
]);

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  timezone: text('timezone').notNull().default(defaultTenantTimezone),
  operatingHours: jsonb('operating_hours')
    .$type<OperatingHours>()
    .notNull()
    .default(
      sql.raw(
        `'${JSON.stringify(defaultOperatingHours).replaceAll("'", "''")}'::jsonb`
      )
    ),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tenantUsers = pgTable(
  'tenant_users',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: tenantRole('role').notNull(),
    phone: text('phone'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('tenant_users_tenant_id_idx').on(table.tenantId),
    uniqueIndex('tenant_users_user_id_unique_idx').on(table.userId),
  ]
);

export const menuCategories = pgTable(
  'menu_categories',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('menu_categories_tenant_id_idx').on(table.tenantId),
    uniqueIndex('menu_categories_tenant_name_unique_idx').on(
      table.tenantId,
      sql`lower(${table.name})`
    ),
  ]
);

export const menuProducts = pgTable(
  'menu_products',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
      .notNull()
      .references(() => menuCategories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isAvailable: boolean('is_available').notNull().default(true),
    pricingMode: menuProductPricingMode('pricing_mode')
      .notNull()
      .default('fixed'),
    priceMinorUnits: integer('price_minor_units'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('menu_products_category_id_idx').on(table.categoryId),
    uniqueIndex('menu_products_category_name_unique_idx').on(
      table.categoryId,
      sql`lower(${table.name})`
    ),
  ]
);

export const menuProductPricingChoices = pgTable(
  'menu_product_pricing_choices',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => menuProducts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isAvailable: boolean('is_available').notNull().default(true),
    priceMinorUnits: integer('price_minor_units').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('menu_product_pricing_choices_product_id_idx').on(table.productId),
    uniqueIndex('menu_product_pricing_choices_product_name_unique_idx').on(
      table.productId,
      sql`lower(${table.name})`
    ),
  ]
);

export const menuAddOnGroups = pgTable(
  'menu_add_on_groups',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('menu_add_on_groups_tenant_id_idx').on(table.tenantId),
    uniqueIndex('menu_add_on_groups_tenant_name_unique_idx').on(
      table.tenantId,
      sql`lower(${table.name})`
    ),
  ]
);

export const menuAddOnItems = pgTable(
  'menu_add_on_items',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => menuAddOnGroups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isAvailable: boolean('is_available').notNull().default(true),
    priceMinorUnits: integer('price_minor_units').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('menu_add_on_items_group_id_idx').on(table.groupId),
    uniqueIndex('menu_add_on_items_group_name_unique_idx').on(
      table.groupId,
      sql`lower(${table.name})`
    ),
  ]
);

export const menuProductAddOnGroups = pgTable(
  'menu_product_add_on_groups',
  {
    productId: text('product_id')
      .notNull()
      .references(() => menuProducts.id, { onDelete: 'cascade' }),
    addOnGroupId: text('add_on_group_id')
      .notNull()
      .references(() => menuAddOnGroups.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({
      name: 'menu_product_add_on_groups_pk',
      columns: [table.productId, table.addOnGroupId],
    }),
    index('menu_product_add_on_groups_add_on_group_id_idx').on(
      table.addOnGroupId
    ),
  ]
);

export const authSchema = {
  user,
  session,
  account,
  verification,
};
