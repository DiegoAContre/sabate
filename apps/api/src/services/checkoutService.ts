import Stripe from 'stripe';
import { eq, sql } from 'drizzle-orm';
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

  const stripe = getStripe();

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
  if (!order || order.status === 'paid') return;

  const pi =
    typeof session.payment_intent === 'string' ? session.payment_intent : null;

  await db
    .update(orders)
    .set({
      status: 'paid',
      stripePaymentIntentId: pi,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  for (const item of order.items) {
    if (item.productId) {
      await db
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(eq(products.id, item.productId));
    }
  }

  await clearCart(order.userId);
}
