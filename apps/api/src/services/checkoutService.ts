import Stripe from 'stripe';
import { and, eq, gte, sql } from 'drizzle-orm';
import { cartItems, db, orderItems, orders, products } from '@sabate/db';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { listCart, clearCart } from './cartService.js';
import type { CheckoutInput } from '../validators/checkout.js';

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError('Stripe is not configured', 503);
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export async function createCheckoutSession(
  userId: string,
  input: CheckoutInput,
): Promise<{ url: string }> {
  const items = await listCart(userId);
  if (items.length === 0) {
    throw new AppError('Cart is empty', 400);
  }

  const short = items.filter((i) => i.quantity > i.product.stock);
  if (short.length > 0) {
    const msg = short
      .map((i) => `Only ${i.product.stock} left in stock for ${i.product.name}`)
      .join('; ');
    throw new AppError(msg, 409);
  }

  // Validate Stripe config before creating any order rows.
  const stripe = getStripe();

  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const shipping = 0;
  const total = subtotal + shipping;

  const [order] = await db
    .insert(orders)
    .values({
      userId,
      status: 'pending',
      subtotal,
      shipping,
      total,
      shippingAddress: input.shippingAddress,
    })
    .returning();

  await db.insert(orderItems).values(
    items.map((i) => ({
      orderId: order.id,
      productId: i.productId,
      productName: i.product.name,
      unitPrice: i.product.price,
      quantity: i.quantity,
    })),
  );

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: items.map((i) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: i.product.name },
        unit_amount: i.product.price,
      },
      quantity: i.quantity,
    })),
    metadata: { orderId: order.id },
    success_url: `${env.CORS_ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CORS_ORIGIN}/checkout/cancel`,
  });

  return { url: session.url! };
}

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true },
  });
  if (!order) return;

  const pi =
    typeof session.payment_intent === 'string' ? session.payment_intent : null;

  const processed = await db.transaction(async (tx) => {
    // Atomic claim: only one webhook delivery wins the pending -> paid transition.
    const claimed = await tx
      .update(orders)
      .set({ status: 'paid', stripePaymentIntentId: pi, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')))
      .returning({ id: orders.id });
    if (claimed.length === 0) return false;

    const short: string[] = [];
    for (const item of order.items) {
      if (!item.productId) continue;
      const res = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(
          and(eq(products.id, item.productId), gte(products.stock, item.quantity)),
        )
        .returning({ id: products.id });
      if (res.length === 0) {
        short.push(item.productName);
      }
    }

    if (short.length > 0) {
      // Payment already captured — flag for admin instead of refunding.
      await tx
        .update(orders)
        .set({ inventoryIssue: true, updatedAt: new Date() })
        .where(eq(orders.id, orderId));
      console.error(
        `[inventory] order ${orderId} paid with insufficient stock: ${short.join(', ')}`,
      );
    }

    return true;
  });

  if (processed) {
    await clearCart(order.userId);
  }
}
