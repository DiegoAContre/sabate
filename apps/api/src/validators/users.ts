import { z } from 'zod';

export const userIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const updateUserSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
