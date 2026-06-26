import { z } from 'zod';

import { weekDays, type OperatingHours } from '../contracts/tenant.js';

const isValidTimezone = (value: string) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm format.');

const minutesFromTime = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);

  return hours * 60 + minutes;
};

const closedOperatingDaySchema = z.strictObject({
  status: z.literal('closed'),
});

const openOperatingDaySchema = z
  .strictObject({
    status: z.literal('open'),
    open: timeSchema,
    close: timeSchema,
  })
  .refine(
    (day) => minutesFromTime(day.open) < minutesFromTime(day.close),
    'Open time must be before close time.'
  );

const operatingDaySchema = z.union([
  closedOperatingDaySchema,
  openOperatingDaySchema,
]);

const operatingHoursShape = Object.fromEntries(
  weekDays.map((day) => [day, operatingDaySchema])
) as Record<(typeof weekDays)[number], typeof operatingDaySchema>;

const operatingHoursSchema = z.strictObject(
  operatingHoursShape
) satisfies z.ZodType<OperatingHours>;

export const updateTenantProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').optional(),
    phone: z.string().trim().min(1, 'Phone is required.').optional(),
    timezone: z
      .string()
      .trim()
      .min(1, 'Timezone is required.')
      .refine((value) => isValidTimezone(value), 'Timezone is invalid.')
      .optional(),
    operatingHours: operatingHoursSchema.optional(),
  })
  .refine(
    (profile) => Object.values(profile).some((value) => value !== undefined),
    'At least one tenant profile field is required.'
  );

export type ValidTenantProfileUpdate = z.infer<
  typeof updateTenantProfileSchema
>;

export const parseTenantProfileUpdate = (value: unknown) =>
  updateTenantProfileSchema.safeParse(value);
