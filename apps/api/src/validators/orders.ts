import { z } from 'zod';

export const orderParamSchema = z.object({
  id: z.string().uuid(),
});
