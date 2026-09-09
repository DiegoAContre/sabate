import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db, products, users } from '@sabate/db';

let counter = 0;

/** Unique suffix for email/slug/name uniqueness across truncate cycles. */
export function unique(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

export async function truncateAll(): Promise<void> {
  await db.execute(
    sql`TRUNCATE order_items, orders, cart_items, products, categories, users RESTART IDENTITY CASCADE`,
  );
}

export async function createUser(
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const [user] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `user-${unique()}@test.dev`,
      name: `User ${unique()}`,
      passwordHash: await bcrypt.hash('password123', 4),
      ...overrides,
    })
    .returning();
  return user;
}

export async function createProduct(
  overrides: Partial<typeof products.$inferInsert> = {},
) {
  const [product] = await db
    .insert(products)
    .values({
      name: `Product ${unique()}`,
      slug: `product-${unique()}`,
      price: 1000,
      stock: 10,
      ...overrides,
    })
    .returning();
  return product;
}

export const testAddress = {
  street: '123 Test St',
  city: 'Testville',
  state: 'TS',
  zipCode: '00000',
  country: 'US',
};
