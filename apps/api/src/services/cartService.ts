import { and, eq } from 'drizzle-orm';
import { cartItems, db, products } from '@sabate/db';
import { AppError } from '../utils/AppError.js';
import type { AddToCartInput, UpdateCartInput } from '../validators/cart.js';

type Product = typeof products.$inferSelect;

export interface CartItem {
  productId: string;
  quantity: number;
  product: Pick<
    Product,
    'id' | 'name' | 'slug' | 'price' | 'images' | 'stock'
  >;
}

export async function listCart(userId: string): Promise<CartItem[]> {
  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.userId, userId),
    with: { product: true },
  });

  return items.map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
    product: {
      id: i.product.id,
      name: i.product.name,
      slug: i.product.slug,
      price: i.product.price,
      images: i.product.images as string[],
      stock: i.product.stock,
    },
  }));
}

export async function addToCart(
  userId: string,
  input: AddToCartInput,
): Promise<void> {
  const product = await db.query.products.findFirst({
    where: eq(products.id, input.productId),
  });
  if (!product || !product.isActive) {
    throw new AppError('Product not available', 400);
  }
  if (product.stock <= 0) {
    throw new AppError('Out of stock', 400);
  }

  const existing = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.userId, userId), eq(cartItems.productId, input.productId)),
  });

  const newQuantity = Math.min(
    (existing?.quantity ?? 0) + input.quantity,
    product.stock,
  );

  if (existing) {
    await db
      .update(cartItems)
      .set({ quantity: newQuantity })
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, input.productId)));
  } else {
    await db.insert(cartItems).values({
      userId,
      productId: input.productId,
      quantity: newQuantity,
    });
  }
}

export async function updateQuantity(
  userId: string,
  productId: string,
  input: UpdateCartInput,
): Promise<void> {
  const item = await db.query.cartItems.findFirst({
    where: and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)),
  });
  if (!item) {
    throw new AppError('Cart item not found', 404);
  }

  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });
  if (!product) {
    throw new AppError('Product not found', 404);
  }

  const quantity = Math.min(input.quantity, product.stock);

  await db
    .update(cartItems)
    .set({ quantity })
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));
}

export async function removeItem(
  userId: string,
  productId: string,
): Promise<void> {
  const result = await db
    .delete(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));

  if (result.rowCount === 0) {
    throw new AppError('Cart item not found', 404);
  }
}

export async function clearCart(userId: string): Promise<void> {
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
}
