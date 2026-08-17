import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import * as catalog from '../services/catalogService.js';
import {
  categoryIdParamSchema,
  categorySchema,
  listProductsQuerySchema,
  productIdParamSchema,
  productSchema,
  type ListProductsQuery,
} from '../validators/catalog.js';

export const catalogRouter = Router();

// Public category routes
catalogRouter.get('/api/categories', async (_req, res) => {
  const data = await catalog.listCategories();
  res.json({ data });
});

catalogRouter.get('/api/categories/:slug', async (req, res) => {
  const category = await catalog.getCategoryBySlug(req.params.slug as string);
  res.json({ category });
});

// Admin category routes
catalogRouter.post(
  '/api/admin/categories',
  authMiddleware,
  requireRole('admin'),
  validate(categorySchema),
  async (req, res) => {
    const category = await catalog.createCategory(req.body);
    res.status(201).json({ category });
  },
);

catalogRouter.put(
  '/api/admin/categories/:id',
  authMiddleware,
  requireRole('admin'),
  validate(categoryIdParamSchema, 'params'),
  validate(categorySchema),
  async (req, res) => {
    const { id } = (req as unknown as Record<string, unknown>).validatedParams as { id: string };
    const category = await catalog.updateCategory(id, req.body);
    res.json({ category });
  },
);

catalogRouter.delete(
  '/api/admin/categories/:id',
  authMiddleware,
  requireRole('admin'),
  validate(categoryIdParamSchema, 'params'),
  async (req, res) => {
    const { id } = (req as unknown as Record<string, unknown>).validatedParams as { id: string };
    await catalog.deleteCategory(id);
    res.status(204).send();
  },
);

// Public product routes
catalogRouter.get(
  '/api/products',
  validate(listProductsQuerySchema, 'query'),
  async (req, res) => {
    const query = (req as unknown as Record<string, unknown>).validatedQuery as ListProductsQuery;
    const result = await catalog.listProducts(query);
    res.json(result);
  },
);

catalogRouter.get('/api/products/:slug', async (req, res) => {
  const product = await catalog.getProductBySlug(req.params.slug as string);
  res.json({ product });
});

// Admin product routes
catalogRouter.post(
  '/api/admin/products',
  authMiddleware,
  requireRole('admin'),
  validate(productSchema),
  async (req, res) => {
    const product = await catalog.createProduct(req.body);
    res.status(201).json({ product });
  },
);

catalogRouter.put(
  '/api/admin/products/:id',
  authMiddleware,
  requireRole('admin'),
  validate(productIdParamSchema, 'params'),
  validate(productSchema),
  async (req, res) => {
    const { id } = (req as unknown as Record<string, unknown>).validatedParams as { id: string };
    const product = await catalog.updateProduct(id, req.body);
    res.json({ product });
  },
);

catalogRouter.delete(
  '/api/admin/products/:id',
  authMiddleware,
  requireRole('admin'),
  validate(productIdParamSchema, 'params'),
  async (req, res) => {
    const { id } = (req as unknown as Record<string, unknown>).validatedParams as { id: string };
    await catalog.deleteProduct(id);
    res.status(204).send();
  },
);
