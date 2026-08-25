import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive().default(1),
});

export const updateCartSchema = z.object({
  quantity: z.coerce.number().int().positive(),
});

export const cartItemParamSchema = z.object({
  productId: z.string().uuid(),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartInput = z.infer<typeof updateCartSchema>;
