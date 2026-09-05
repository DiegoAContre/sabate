import { z } from 'zod';

export const orderParamSchema = z.object({
  id: z.string().uuid(),
});

export const updateOrderSchema = z
  .object({
    status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled']).optional(),
    inventoryIssue: z.boolean().optional(),
  })
  .refine((v) => v.status !== undefined || v.inventoryIssue !== undefined, {
    message: 'Nothing to update',
  });

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
