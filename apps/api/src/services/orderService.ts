import { eq } from 'drizzle-orm';
import { db, orders } from '@sabate/db';
import { AppError } from '../utils/AppError.js';
import type { UpdateOrderInput } from '../validators/orders.js';

const orderWithItemsAndUser = {
  items: true,
  user: {
    columns: {
      id: true,
      email: true,
      name: true,
    },
  },
} as const;

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

export async function listAllOrders() {
  return db.query.orders.findMany({
    with: orderWithItemsAndUser,
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
  });
}

export async function updateOrder(orderId: string, input: UpdateOrderInput) {
  const existing = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: orderWithItemsAndUser,
  });
  if (!existing) {
    throw new AppError('Order not found', 404);
  }

  const [order] = await db
    .update(orders)
    .set({
      ...(input.status !== undefined && { status: input.status }),
      ...(input.inventoryIssue !== undefined && { inventoryIssue: input.inventoryIssue }),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .returning();

  return { ...order, items: existing.items, user: existing.user };
}
