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

const choiceNameKey = (name: string) => name.toLocaleLowerCase('en-US');

const addDuplicateChoiceNameIssues = (
  choices: Array<{ name: string }>,
  context: z.RefinementCtx
) => {
  const seenChoiceNames = new Map<string, number>();

  choices.forEach((choice, index) => {
    const key = choiceNameKey(choice.name);
    const firstIndex = seenChoiceNames.get(key);

    if (firstIndex === undefined) {
      seenChoiceNames.set(key, index);
      return;
    }

    context.addIssue({
      code: 'custom',
      message: 'Choice names must be unique within a product.',
      path: [index, 'name'],
    });
  });
};

const addDuplicateAddOnItemNameIssues = (
  items: Array<{ name: string }>,
  context: z.RefinementCtx
) => {
  const seenItemNames = new Map<string, number>();

  items.forEach((item, index) => {
    const key = choiceNameKey(item.name);
    const firstIndex = seenItemNames.get(key);

    if (firstIndex === undefined) {
      seenItemNames.set(key, index);
      return;
    }

    context.addIssue({
      code: 'custom',
      message: 'Add-on item names must be unique within a group.',
      path: [index, 'name'],
    });
  });
};

const addOnGroupIdsSchema = z
  .array(z.string().trim().min(1))
  .superRefine((groupIds, context) => {
    const seenGroupIds = new Set<string>();

    groupIds.forEach((groupId, index) => {
      if (seenGroupIds.has(groupId)) {
        context.addIssue({
          code: 'custom',
          message: 'Add-on group IDs must be unique within a product.',
          path: [index],
        });
        return;
      }

      seenGroupIds.add(groupId);
    });
  });

const fixedPriceProductBaseSchema = {
  name: z.string().trim().min(1),
  description: descriptionSchema,
  price: priceMinorUnitsSchema,
};

const legacyFixedPriceProductCreateSchema = z
  .strictObject(fixedPriceProductBaseSchema)
  .extend({
    isAvailable: z.boolean().default(true),
    addOnGroupIds: addOnGroupIdsSchema.default([]),
  })
  .transform(({ price, ...product }) => ({
    ...product,
    pricingMode: 'fixed' as const,
    priceMinorUnits: price,
  }));

const legacyFixedPriceProductUpdateSchema = z
  .strictObject(fixedPriceProductBaseSchema)
  .extend({
    isAvailable: z.boolean(),
    addOnGroupIds: addOnGroupIdsSchema,
  })
  .transform(({ price, ...product }) => ({
    ...product,
    pricingMode: 'fixed' as const,
    priceMinorUnits: price,
  }));

const fixedPriceProductPricingSchema = z.strictObject({
  price: priceMinorUnitsSchema,
});

const explicitFixedPriceProductBaseSchema = {
  name: z.string().trim().min(1),
  description: descriptionSchema,
  pricingMode: z.literal('fixed'),
  pricing: fixedPriceProductPricingSchema,
};

const explicitFixedPriceProductCreateSchema = z
  .strictObject(explicitFixedPriceProductBaseSchema)
  .extend({
    isAvailable: z.boolean().default(true),
    addOnGroupIds: addOnGroupIdsSchema.default([]),
  })
  .transform(({ pricing, ...product }) => ({
    ...product,
    priceMinorUnits: pricing.price,
  }));

const explicitFixedPriceProductUpdateSchema = z
  .strictObject(explicitFixedPriceProductBaseSchema)
  .extend({
    isAvailable: z.boolean(),
    addOnGroupIds: addOnGroupIdsSchema,
  })
  .transform(({ pricing, ...product }) => ({
    ...product,
    priceMinorUnits: pricing.price,
  }));

export const fixedPriceProductCreateSchema = z.union([
  legacyFixedPriceProductCreateSchema,
  explicitFixedPriceProductCreateSchema,
]);

export const fixedPriceProductUpdateSchema = z.union([
  legacyFixedPriceProductUpdateSchema,
  explicitFixedPriceProductUpdateSchema,
]);

export type ValidFixedPriceProductCreateRequest = z.infer<
  typeof fixedPriceProductCreateSchema
>;
export type ValidFixedPriceProductUpdateRequest = z.infer<
  typeof fixedPriceProductUpdateSchema
>;

const choicePricedProductChoiceCreateSchema = z
  .strictObject({
    name: z.string().trim().min(1),
    isAvailable: z.boolean().default(true),
    price: priceMinorUnitsSchema,
  })
  .transform(({ price, ...choice }) => ({
    ...choice,
    priceMinorUnits: price,
  }));

const choicePricedProductChoiceUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1),
    isAvailable: z.boolean(),
    price: priceMinorUnitsSchema,
  })
  .transform(({ price, ...choice }) => ({
    ...choice,
    priceMinorUnits: price,
  }));

const choicePricedProductCreateSchema = z
  .strictObject({
    name: z.string().trim().min(1),
    description: descriptionSchema,
    isAvailable: z.boolean().default(true),
    addOnGroupIds: addOnGroupIdsSchema.default([]),
    pricingMode: z.literal('priced_by_choice'),
    pricing: z.strictObject({
      choices: z
        .array(choicePricedProductChoiceCreateSchema)
        .min(1)
        .superRefine(addDuplicateChoiceNameIssues),
    }),
  })
  .transform(({ pricing, ...product }) => ({
    ...product,
    choices: pricing.choices,
  }));

const choicePricedProductUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1),
    description: descriptionSchema,
    isAvailable: z.boolean(),
    addOnGroupIds: addOnGroupIdsSchema,
    pricingMode: z.literal('priced_by_choice'),
    pricing: z.strictObject({
      choices: z
        .array(choicePricedProductChoiceUpdateSchema)
        .min(1)
        .superRefine(addDuplicateChoiceNameIssues),
    }),
  })
  .transform(({ pricing, ...product }) => ({
    ...product,
    choices: pricing.choices,
  }));

export type ValidChoicePricedProductCreateRequest = z.infer<
  typeof choicePricedProductCreateSchema
>;
export type ValidChoicePricedProductUpdateRequest = z.infer<
  typeof choicePricedProductUpdateSchema
>;

export const parseFixedPriceProductCreateRequest = (value: unknown) =>
  fixedPriceProductCreateSchema.safeParse(value);

export const parseFixedPriceProductUpdateRequest = (value: unknown) =>
  fixedPriceProductUpdateSchema.safeParse(value);

export const parseChoicePricedProductCreateRequest = (value: unknown) =>
  choicePricedProductCreateSchema.safeParse(value);

export const parseChoicePricedProductUpdateRequest = (value: unknown) =>
  choicePricedProductUpdateSchema.safeParse(value);

const addOnItemCreateSchema = z
  .strictObject({
    name: z.string().trim().min(1),
    isAvailable: z.boolean().default(true),
    price: priceMinorUnitsSchema,
  })
  .transform(({ price, ...item }) => ({
    ...item,
    priceMinorUnits: price,
  }));

const addOnItemUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1),
    isAvailable: z.boolean(),
    price: priceMinorUnitsSchema,
  })
  .transform(({ price, ...item }) => ({
    ...item,
    priceMinorUnits: price,
  }));

const addOnGroupCreateSchema = z.strictObject({
  name: z.string().trim().min(1),
  items: z
    .array(addOnItemCreateSchema)
    .min(1)
    .superRefine(addDuplicateAddOnItemNameIssues),
});

const addOnGroupUpdateSchema = z.strictObject({
  name: z.string().trim().min(1),
  items: z
    .array(addOnItemUpdateSchema)
    .min(1)
    .superRefine(addDuplicateAddOnItemNameIssues),
});

export type ValidAddOnGroupCreateRequest = z.infer<
  typeof addOnGroupCreateSchema
>;
export type ValidAddOnGroupUpdateRequest = z.infer<
  typeof addOnGroupUpdateSchema
>;

export const parseAddOnGroupCreateRequest = (value: unknown) =>
  addOnGroupCreateSchema.safeParse(value);

export const parseAddOnGroupUpdateRequest = (value: unknown) =>
  addOnGroupUpdateSchema.safeParse(value);
