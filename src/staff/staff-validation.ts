import { z } from 'zod';

import type { StaffRole } from '../contracts/roles.js';

const createStaffBaseSchema = {
  name: z.string(),
  email: z.string().trim().toLowerCase(),
  password: z.string(),
};

export const createStaffSchema = z.discriminatedUnion('role', [
  z.object({
    ...createStaffBaseSchema,
    role: z.literal('manager'),
    phone: z
      .string()
      .trim()
      .nullish()
      .transform((phone) => (phone && phone.length > 0 ? phone : null)),
  }),
  z.object({
    ...createStaffBaseSchema,
    role: z.literal('courier'),
    phone: z.string().trim().min(1),
  }),
]);

export type ValidCreateStaffRequest = z.infer<typeof createStaffSchema>;

export const parseCreateStaffRequest = (value: unknown) =>
  createStaffSchema.safeParse(value);

const updateCourierProfileSchema = z
  .strictObject({
    name: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
  })
  .refine(
    (profile) => Object.values(profile).some((value) => value !== undefined),
    'At least one courier profile field is required.'
  );

type ValidUpdateCourierProfileRequest = z.infer<
  typeof updateCourierProfileSchema
>;

const updateManagerProfileSchema = z
  .strictObject({
    name: z.string().trim().min(1).optional(),
    phone: z
      .string()
      .trim()
      .transform((phone) => (phone.length > 0 ? phone : null))
      .nullable()
      .optional(),
  })
  .refine(
    (profile) => Object.values(profile).some((value) => value !== undefined),
    'At least one manager profile field is required.'
  );

type ValidUpdateManagerProfileRequest = z.infer<
  typeof updateManagerProfileSchema
>;

export type ValidStaffProfileUpdate =
  | ValidUpdateManagerProfileRequest
  | ValidUpdateCourierProfileRequest;

export const parseStaffProfileUpdate = (role: StaffRole, value: unknown) =>
  role === 'courier'
    ? updateCourierProfileSchema.safeParse(value)
    : updateManagerProfileSchema.safeParse(value);
