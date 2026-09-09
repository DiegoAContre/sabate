import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addToCart,
  clearCart,
  listCart,
  removeItem,
  updateQuantity,
} from '../src/services/cartService.js';
import { createProduct, createUser, truncateAll } from './db.js';

beforeEach(truncateAll);

describe('addToCart', () => {
  it('adds a product and lists it', async () => {
    const user = await createUser();
    const product = await createProduct({ stock: 5 });

    await addToCart(user.id, { productId: product.id, quantity: 2 });
    const cart = await listCart(user.id);

    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({
      productId: product.id,
      quantity: 2,
      product: { id: product.id, price: 1000, stock: 5 },
    });
  });

  it('caps the combined quantity at available stock', async () => {
    const user = await createUser();
    const product = await createProduct({ stock: 3 });

    await addToCart(user.id, { productId: product.id, quantity: 2 });
    await addToCart(user.id, { productId: product.id, quantity: 5 });

    const cart = await listCart(user.id);
    expect(cart[0]?.quantity).toBe(3); // 2 + 5 clamped to stock
  });

  it('rejects unavailable products with 400', async () => {
    const user = await createUser();
    const inactive = await createProduct({ isActive: false });
    const outOfStock = await createProduct({ stock: 0 });

    await expect(
      addToCart(user.id, { productId: inactive.id, quantity: 1 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Product not available',
    });
    await expect(
      addToCart(user.id, { productId: outOfStock.id, quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Out of stock' });
    await expect(
      addToCart(user.id, { productId: randomUUID(), quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('updateQuantity', () => {
  it('clamps to stock and stores smaller values', async () => {
    const user = await createUser();
    const product = await createProduct({ stock: 3 });
    await addToCart(user.id, { productId: product.id, quantity: 1 });

    await updateQuantity(user.id, product.id, { quantity: 99 });
    expect((await listCart(user.id))[0]?.quantity).toBe(3); // clamped

    await updateQuantity(user.id, product.id, { quantity: 2 });
    expect((await listCart(user.id))[0]?.quantity).toBe(2);
  });

  it('rejects with 404 for a missing cart item', async () => {
    const user = await createUser();
    const product = await createProduct({ stock: 3 });

    await expect(
      updateQuantity(user.id, product.id, { quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Cart item not found' });
  });
});

describe('removeItem', () => {
  it('removes and then 404s on repeat', async () => {
    const user = await createUser();
    const product = await createProduct({ stock: 3 });
    await addToCart(user.id, { productId: product.id, quantity: 1 });

    await removeItem(user.id, product.id);
    expect(await listCart(user.id)).toHaveLength(0);
    await expect(removeItem(user.id, product.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('clearCart', () => {
  it('empties the user cart', async () => {
    const user = await createUser();
    const a = await createProduct({ stock: 3 });
    const b = await createProduct({ stock: 3 });
    await addToCart(user.id, { productId: a.id, quantity: 1 });
    await addToCart(user.id, { productId: b.id, quantity: 2 });

    await clearCart(user.id);
    expect(await listCart(user.id)).toHaveLength(0);
  });
});
