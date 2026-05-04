import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from './db/index.js';
import { authSchema } from './db/schema.js';

const isProduction = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  appName: 'Order Management System',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (isProduction ? undefined : 'dev-secret-at-least-32-characters'),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
});
