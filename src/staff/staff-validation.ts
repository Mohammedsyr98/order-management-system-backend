import { z } from 'zod';

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

export const updateManagerProfileSchema = z
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

export type ValidUpdateManagerProfileRequest = z.infer<
  typeof updateManagerProfileSchema
>;

export const parseUpdateManagerProfileRequest = (value: unknown) =>
  updateManagerProfileSchema.safeParse(value);
