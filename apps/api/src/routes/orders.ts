import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { orderParamSchema } from '../validators/orders.js';
import { listOrders, getOrder } from '../services/orderService.js';

export const ordersRouter = Router();

ordersRouter.use(authMiddleware);

ordersRouter.get('/api/orders', async (req, res) => {
  const orders = await listOrders(req.user!.sub);
  res.json({ orders });
});

ordersRouter.get(
  '/api/orders/:id',
  validate(orderParamSchema, 'params'),
  async (req, res) => {
    const { id } = (req as unknown as Record<string, unknown>)
      .validatedParams as { id: string };
    const order = await getOrder(req.user!.sub, id);
    res.json({ order });
  },
);
