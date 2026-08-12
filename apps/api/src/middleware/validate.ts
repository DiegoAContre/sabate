import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

type Source = 'body' | 'query' | 'params';

export function validate(schema: z.ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    (req as unknown as Record<string, unknown>)[source] = parsed.data;
    next();
  };
}
