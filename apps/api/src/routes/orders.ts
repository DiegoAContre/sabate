import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { orderParamSchema, updateOrderStatusSchema } from '../validators/orders.js';
import { listOrders, getOrder, listAllOrders, updateOrderStatus } from '../services/orderService.js';

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

ordersRouter.get('/api/admin/orders', requireRole('admin'), async (_req, res) => {
  const orders = await listAllOrders();
  res.json({ orders });
});

ordersRouter.patch(
  '/api/admin/orders/:id/status',
  requireRole('admin'),
  validate(orderParamSchema, 'params'),
  validate(updateOrderStatusSchema),
  async (req, res) => {
    const { id } = (req as unknown as Record<string, unknown>)
      .validatedParams as { id: string };
    const order = await updateOrderStatus(id, req.body);
    res.json({ order });
  },
);
