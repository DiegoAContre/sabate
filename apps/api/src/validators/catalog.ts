import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  parentCategoryId: z.string().uuid().nullable().optional(),
});

export const categoryIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  price: z.coerce.number().int().positive('Price must be a positive integer (cents)'),
  compareAtPrice: z.coerce.number().int().positive().optional(),
  stock: z.coerce.number().int().min(0).default(0),
  categoryId: z.string().uuid().optional().nullable(),
  images: z.array(z.string().url()).default([]),
  isActive: z.boolean().optional(),
});

export const productIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  categoryId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'price', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
