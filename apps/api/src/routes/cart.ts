import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import * as cart from '../services/cartService.js';
import {
  addToCartSchema,
  cartItemParamSchema,
  updateCartSchema,
} from '../validators/cart.js';

export const cartRouter = Router();

cartRouter.use(authMiddleware);

cartRouter.get('/api/cart', async (req, res) => {
  const items = await cart.listCart(req.user!.sub);
  res.json({ items });
});

cartRouter.post('/api/cart', validate(addToCartSchema), async (req, res) => {
  await cart.addToCart(req.user!.sub, req.body);
  res.status(201).json({ ok: true });
});

cartRouter.put(
  '/api/cart/:productId',
  validate(cartItemParamSchema, 'params'),
  validate(updateCartSchema),
  async (req, res) => {
    const { productId } = (req as unknown as Record<string, unknown>)
      .validatedParams as { productId: string };
    await cart.updateQuantity(req.user!.sub, productId, req.body);
    res.json({ ok: true });
  },
);

cartRouter.delete(
  '/api/cart/:productId',
  validate(cartItemParamSchema, 'params'),
  async (req, res) => {
    const { productId } = (req as unknown as Record<string, unknown>)
      .validatedParams as { productId: string };
    await cart.removeItem(req.user!.sub, productId);
    res.status(204).send();
  },
);
