import { z } from 'zod';

export const menuCategorySchema = z.strictObject({
  name: z.string().trim().min(1),
});

export type ValidMenuCategoryRequest = z.infer<typeof menuCategorySchema>;

export const parseMenuCategoryRequest = (value: unknown) =>
  menuCategorySchema.safeParse(value);
