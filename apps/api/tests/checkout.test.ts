import Stripe from 'stripe';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cartItems, db, orderItems, orders, products } from '@sabate/db';
import {
  createCheckoutSession,
  handleCheckoutCompleted,
} from '../src/services/checkoutService.js';
import { addToCart } from '../src/services/cartService.js';
import {
  testAddress,
  createProduct,
  createUser,
  truncateAll,
} from './db.js';

beforeEach(truncateAll);

function fakeSession(orderId: string, pi = 'pi_test_1'): Stripe.Checkout.Session {
  return {
    id: `cs_${pi}`,
    object: 'checkout.session',
    metadata: { orderId },
    payment_intent: pi,
  } as unknown as Stripe.Checkout.Session;
}

function findOrder(id: string) {
  return db.query.orders.findFirst({ where: eq(orders.id, id) });
}

function findProduct(id: string) {
  return db.query.products.findFirst({ where: eq(products.id, id) });
}

describe('createCheckoutSession', () => {
  it('rejects with 409 when cart quantity exceeds stock', async () => {
    const user = await createUser();
    const product = await createProduct({ stock: 2 });
    await addToCart(user.id, { productId: product.id, quantity: 2 });
    // Services clamp to stock, so overstate the line directly to reach the guard.
    await db
      .update(cartItems)
      .set({ quantity: 5 })
      .where(eq(cartItems.productId, product.id));

    await expect(
      createCheckoutSession(user.id, { shippingAddress: testAddress }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('Only 2 left in stock'),
    });
  });

  it('rejects with 400 when the cart is empty', async () => {
    const user = await createUser();

    await expect(
      createCheckoutSession(user.id, { shippingAddress: testAddress }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Cart is empty' });
  });

  it('rejects with 503 when Stripe is unconfigured, without creating order rows', async () => {
    const user = await createUser();
    const product = await createProduct({ stock: 10 });
    await addToCart(user.id, { productId: product.id, quantity: 2 });

    await expect(
      createCheckoutSession(user.id, { shippingAddress: testAddress }),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: 'Stripe is not configured',
    });

    const rows = await db.query.orders.findMany({
      where: eq(orders.userId, user.id),
    });
    expect(rows).toHaveLength(0); // Stripe validated BEFORE order insert — no orphans.
  });
});

describe('handleCheckoutCompleted', () => {
  async function seedOrder(quantity: number, stock: number) {
    const user = await createUser();
    const product = await createProduct({ stock });
    const [order] = await db
      .insert(orders)
      .values({
        userId: user.id,
        status: 'pending',
        subtotal: product.price * quantity,
        total: product.price * quantity,
        shippingAddress: testAddress,
      })
      .returning();
    await db.insert(orderItems).values({
      orderId: order.id,
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity,
    });
    await db
      .insert(cartItems)
      .values({ userId: user.id, productId: product.id, quantity: 1 });
    return { order, product };
  }

  it('pays, decrements stock once and clears the cart; duplicate delivery is a no-op', async () => {
    const { order, product } = await seedOrder(3, 5);
    const session = fakeSession(order.id);

    await handleCheckoutCompleted(session);
    await handleCheckoutCompleted(session); // duplicated webhook delivery

    const after = await findOrder(order.id);
    expect(after?.status).toBe('paid');
    expect(after?.stripePaymentIntentId).toBe('pi_test_1');
    expect((await findProduct(product.id))?.stock).toBe(2); // decremented once
    expect(await db.query.cartItems.findMany()).toHaveLength(0);
  });

  it('flags inventory_issue and logs when stock ran out after payment', async () => {
    const logged: string[] = [];
    const spy = vi
      .spyOn(console, 'error')
      .mockImplementation((msg: unknown) => void logged.push(String(msg)));

    const { order, product } = await seedOrder(10, 2);
    await handleCheckoutCompleted(fakeSession(order.id));

    spy.mockRestore();
    const after = await findOrder(order.id);
    expect(after?.status).toBe('paid');
    expect(after?.inventoryIssue).toBe(true);
    expect((await findProduct(product.id))?.stock).toBe(2); // untouched — flagged, not partially decremented
    expect(logged.join(' ')).toContain('insufficient stock');
  });

  it('no-ops for sessions without a tracked order', async () => {
    await expect(
      handleCheckoutCompleted({ metadata: {} } as unknown as Stripe.Checkout.Session),
    ).resolves.toBeUndefined();

    const { product } = await seedOrder(1, 5);
    await expect(
      handleCheckoutCompleted(fakeSession('00000000-0000-0000-0000-000000000000')),
    ).resolves.toBeUndefined();
    expect((await findProduct(product.id))?.stock).toBe(5); // untouched
  });

  it('CHECK constraint blocks negative stock', async () => {
    const product = await createProduct({ stock: 1 });
    await expect(
      db
        .update(products)
        .set({ stock: sql`${products.stock} - 999` })
        .where(eq(products.id, product.id)),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
  });
});
