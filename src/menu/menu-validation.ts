import { z } from 'zod';

const maximumIntegerMinorUnits = 2_147_483_647n;
const decimalPricePattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export const menuCategorySchema = z.strictObject({
  name: z.string().trim().min(1),
});

export type ValidMenuCategoryRequest = z.infer<typeof menuCategorySchema>;

export const parseMenuCategoryRequest = (value: unknown) =>
  menuCategorySchema.safeParse(value);

export const parsePriceMinorUnits = (value: string): number | null => {
  if (!decimalPricePattern.test(value)) {
    return null;
  }

  const [wholeUnits, fractionalUnits = ''] = value.split('.');
  const minorUnits =
    BigInt(wholeUnits) * 100n + BigInt(fractionalUnits.padEnd(2, '0'));

  if (minorUnits > maximumIntegerMinorUnits) {
    return null;
  }

  return Number(minorUnits);
};

export const formatMinorUnitsPrice = (minorUnits: number) => {
  const wholeUnits = Math.floor(minorUnits / 100);
  const fractionalUnits = String(minorUnits % 100).padStart(2, '0');

  return `${wholeUnits}.${fractionalUnits}`;
};

const descriptionSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const description = value.trim();

    return description.length === 0 ? null : description;
  }

  return value;
}, z.string().min(1).nullable());

const priceMinorUnitsSchema = z.string().transform((value, context) => {
  const priceMinorUnits = parsePriceMinorUnits(value);

  if (priceMinorUnits === null) {
    context.addIssue({
      code: 'custom',
      message: 'Price must be a non-negative decimal string.',
    });

    return z.NEVER;
  }

  return priceMinorUnits;
});

const fixedPriceProductBaseSchema = z.strictObject({
  name: z.string().trim().min(1),
  description: descriptionSchema,
  price: priceMinorUnitsSchema,
});

export const fixedPriceProductCreateSchema = fixedPriceProductBaseSchema
  .extend({
    isAvailable: z.boolean().default(true),
  })
  .transform(({ price, ...product }) => ({
    ...product,
    priceMinorUnits: price,
  }));

export const fixedPriceProductUpdateSchema = fixedPriceProductBaseSchema
  .extend({
    isAvailable: z.boolean(),
  })
  .transform(({ price, ...product }) => ({
    ...product,
    priceMinorUnits: price,
  }));

export type ValidFixedPriceProductCreateRequest = z.infer<
  typeof fixedPriceProductCreateSchema
>;
export type ValidFixedPriceProductUpdateRequest = z.infer<
  typeof fixedPriceProductUpdateSchema
>;

export const parseFixedPriceProductCreateRequest = (value: unknown) =>
  fixedPriceProductCreateSchema.safeParse(value);

export const parseFixedPriceProductUpdateRequest = (value: unknown) =>
  fixedPriceProductUpdateSchema.safeParse(value);
