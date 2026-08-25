import { eq } from 'drizzle-orm';
import { db, orderItems, orders } from '@sabate/db';
import { AppError } from '../utils/AppError.js';

export async function getOrder(userId: string, orderId: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true },
  });

  if (!order || order.userId !== userId) {
    throw new AppError('Order not found', 404);
  }

  return order;
}

export async function listOrders(userId: string) {
  return db.query.orders.findMany({
    where: eq(orders.userId, userId),
    with: { items: true },
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
  });
}
