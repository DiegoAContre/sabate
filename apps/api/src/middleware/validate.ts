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
    // Express 5 makes req.query / req.params read-only, so we write validated data
    // to a writable property for query/params while keeping body replacement.
    if (source === 'body') {
      (req as unknown as Record<string, unknown>).body = parsed.data;
    } else {
      const key = `validated${source.charAt(0).toUpperCase() + source.slice(1)}`;
      (req as unknown as Record<string, unknown>)[key] = parsed.data;
    }
    next();
  };
}
