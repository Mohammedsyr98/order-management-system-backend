import { z } from 'zod';

import { STAFF_ROLES } from '../contracts/roles.js';

export const createStaffSchema = z.object({
  name: z.string(),
  email: z.string().trim().toLowerCase(),
  password: z.string(),
  role: z.enum(STAFF_ROLES),
  phone: z
    .string()
    .trim()
    .nullish()
    .transform((phone) => (phone && phone.length > 0 ? phone : null)),
});

export type ValidCreateStaffRequest = z.infer<typeof createStaffSchema>;

export const parseCreateStaffRequest = (value: unknown) =>
  createStaffSchema.safeParse(value);
