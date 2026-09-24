import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { PAYMENT_METHODS } from '../lib/payment';

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date());

export const users = sqliteTable('users', {
  id: id(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['owner', 'seller'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
});

// Standardized pick-lists: products choose from these, they're never typed free
// (so "adidas"/"Adidas" can't both exist). Both are optional on a product.
export const categories = sqliteTable('categories', {
  id: id(),
  name: text('name').notNull(),
});

export const brands = sqliteTable('brands', {
  id: id(),
  name: text('name').notNull(),
});

export const products = sqliteTable(
  'products',
  {
    id: id(),
    name: text('name').notNull(),
    categoryId: text('category_id').references(() => categories.id),
    brandId: text('brand_id').references(() => brands.id),
    // Money in integer cents — same convention as the e-commerce schema.
    price: integer('price').notNull(),
    stock: integer('stock').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [check('products_stock_non_negative', sql`${t.stock} >= 0`)],
);

export const sales = sqliteTable(
  'sales',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    total: integer('total').notNull(),
    paymentMethod: text('payment_method', { enum: PAYMENT_METHODS }).notNull(),
    // Snapshot of the day's exchange rate (bs_per_usd, integer céntimos de Bs)
    // at the moment of sale — receipts and reports compute Bs exactly.
    exchangeRate: integer('exchange_rate').notNull(),
    note: text('note'),
    createdAt: createdAt(),
    // Set when the sale is voided: the row stays (history) but leaves the totals.
    // No FK on voided_by on purpose: drizzle-kit's SQLite path recreates the
    // table for FK columns and chokes; users are never deleted anyway.
    voidedAt: integer('voided_at', { mode: 'timestamp' }),
    voidedBy: text('voided_by'),
  },
  (t) => [index('sales_created_at_idx').on(t.createdAt)],
);

export const saleItems = sqliteTable(
  'sale_items',
  {
    id: id(),
    saleId: text('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    // Snapshot of what was actually sold; product can be deactivated later.
    productId: text('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    productName: text('product_name').notNull(),
    unitPrice: integer('unit_price').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => [index('sale_items_sale_id_idx').on(t.saleId)],
);

// Audit trail: every sale, stock receive and manual adjustment writes one row.
export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: id(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: text('reason', {
      enum: ['venta', 'recepcion', 'ajuste', 'anulacion'],
    }).notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    saleId: text('sale_id').references(() => sales.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('stock_movements_product_id_idx').on(t.productId)],
);

// Daily USD→Bs rate, append-only history. Current rate = latest row.
// bsPerUsd stored as integer céntimos de Bs per 1 USD (9100.50 Bs → 910050).
// A rate is valid for 12 hours from when it was set (lib/rate.ts enforces).
export const exchangeRates = sqliteTable(
  'exchange_rates',
  {
    id: id(),
    bsPerUsd: integer('bs_per_usd').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index('exchange_rates_created_at_idx').on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
