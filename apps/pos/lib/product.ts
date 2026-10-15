import { and, eq, sql } from 'drizzle-orm';
import { db, productSizes, products, stockMovements } from '@/db/client';

// A product's stock is the sum of its sizes. Products without real sizes keep a
// single row labelled «Única» (also the backfill target for legacy products).
export const DEFAULT_SIZE = 'ÚNICA';

export function normalizeSize(size: string): string {
  return size.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function normalizeCode(code: string | null | undefined): string | null {
  const trimmed = code?.trim();
  return trimmed ? trimmed : null;
}

export interface SizeInput {
  size: string;
  quantity: number;
}

export class ProductError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function log(
  tx: Tx,
  productId: string,
  userId: string,
  size: string,
  delta: number,
  reason: 'venta' | 'recepcion' | 'ajuste' | 'anulacion',
  note?: string | null,
) {
  tx.insert(stockMovements)
    .values({ productId, userId, size, delta, reason, note: note ?? null })
    .run();
}

/** `products.stock` is a cache of `SUM(product_sizes.quantity)` — always recompute. */
function recomputeStock(tx: Tx, productId: string) {
  tx.update(products)
    .set({
      stock: sql`(SELECT COALESCE(SUM(quantity), 0) FROM product_sizes WHERE product_id = ${productId})`,
    })
    .where(eq(products.id, productId))
    .run();
}

/** Insert/update a product's sizes to match `sizes`; log the deltas and recompute the total. */
function reconcileSizes(
  tx: Tx,
  {
    productId,
    userId,
    sizes,
  }: { productId: string; userId: string; sizes: SizeInput[] },
) {
  const normalized = sizes.map((s) => ({
    size: normalizeSize(s.size),
    quantity: s.quantity,
  }));
  const existing = tx
    .select()
    .from(productSizes)
    .where(eq(productSizes.productId, productId))
    .all();
  const byName = new Map(existing.map((r) => [r.size, r]));
  const desired = new Set(normalized.map((s) => s.size));

  for (const { size, quantity } of normalized) {
    const row = byName.get(size);
    if (!row) {
      tx.insert(productSizes).values({ productId, size, quantity }).run();
      if (quantity > 0) log(tx, productId, userId, size, quantity, 'recepcion', 'Alta de talla');
    } else if (row.quantity !== quantity) {
      const delta = quantity - row.quantity;
      tx.update(productSizes).set({ quantity }).where(eq(productSizes.id, row.id)).run();
      log(tx, productId, userId, size, delta, delta > 0 ? 'recepcion' : 'ajuste', null);
    }
  }

  for (const row of existing) {
    if (!desired.has(row.size)) {
      tx.delete(productSizes).where(eq(productSizes.id, row.id)).run();
      if (row.quantity > 0) {
        log(tx, productId, userId, row.size, -row.quantity, 'ajuste', 'Talla eliminada');
      }
    }
  }

  recomputeStock(tx, productId);
}

export interface CreateProductInput {
  userId: string;
  name: string;
  code?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  price: number;
  lowStockThreshold: number;
  sizes: SizeInput[];
}

export function createProduct(input: CreateProductInput) {
  return db.transaction((tx) => {
    const [created] = tx
      .insert(products)
      .values({
        name: input.name,
        code: normalizeCode(input.code),
        categoryId: input.categoryId || null,
        brandId: input.brandId || null,
        price: input.price,
        lowStockThreshold: input.lowStockThreshold,
        stock: 0,
      })
      .returning()
      .all();

    reconcileSizes(tx, {
      productId: created.id,
      userId: input.userId,
      sizes: input.sizes,
    });

    return tx.select().from(products).where(eq(products.id, created.id)).get()!;
  });
}

export interface UpdateProductInput {
  userId: string;
  name?: string;
  code?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  price?: number;
  lowStockThreshold?: number;
  isActive?: boolean;
  /** When present, the full desired size list (min 1). */
  sizes?: SizeInput[];
}

export function updateProduct(id: string, input: UpdateProductInput) {
  return db.transaction((tx) => {
    const exists = tx.select().from(products).where(eq(products.id, id)).get();
    if (!exists) return null;

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.code !== undefined) updates.code = normalizeCode(input.code);
    if (input.categoryId !== undefined) updates.categoryId = input.categoryId || null;
    if (input.brandId !== undefined) updates.brandId = input.brandId || null;
    if (input.price !== undefined) updates.price = input.price;
    if (input.lowStockThreshold !== undefined) {
      updates.lowStockThreshold = input.lowStockThreshold;
    }
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    if (Object.keys(updates).length > 0) {
      tx.update(products).set(updates).where(eq(products.id, id)).run();
    }
    if (input.sizes) {
      reconcileSizes(tx, { productId: id, userId: input.userId, sizes: input.sizes });
    }

    return tx.select().from(products).where(eq(products.id, id)).get()!;
  });
}

/** Recepción: +N units of one size. */
export function receiveSize(
  productId: string,
  userId: string,
  rawSize: string,
  quantity: number,
  note?: string | null,
) {
  return db.transaction((tx) => {
    const size = normalizeSize(rawSize);
    const row = tx
      .select()
      .from(productSizes)
      .where(and(eq(productSizes.productId, productId), eq(productSizes.size, size)))
      .get();
    const current = row?.quantity ?? 0;
    if (row) {
      tx.update(productSizes)
        .set({ quantity: current + quantity })
        .where(eq(productSizes.id, row.id))
        .run();
    } else {
      tx.insert(productSizes).values({ productId, size, quantity }).run();
    }
    log(tx, productId, userId, size, quantity, 'recepcion', note);
    recomputeStock(tx, productId);
  });
}

/** Ajuste por conteo: set one size to the counted total. */
export function adjustSize(
  productId: string,
  userId: string,
  rawSize: string,
  newQuantity: number,
  note?: string | null,
) {
  return db.transaction((tx) => {
    const size = normalizeSize(rawSize);
    const row = tx
      .select()
      .from(productSizes)
      .where(and(eq(productSizes.productId, productId), eq(productSizes.size, size)))
      .get();
    const current = row?.quantity ?? 0;
    const delta = newQuantity - current;
    if (row) {
      tx.update(productSizes).set({ quantity: newQuantity }).where(eq(productSizes.id, row.id)).run();
    } else {
      tx.insert(productSizes).values({ productId, size, quantity: newQuantity }).run();
    }
    if (delta !== 0) log(tx, productId, userId, size, delta, 'ajuste', note);
    recomputeStock(tx, productId);
  });
}

export function listProductSizes(productId: string) {
  return db
    .select()
    .from(productSizes)
    .where(eq(productSizes.productId, productId))
    .orderBy(productSizes.size)
    .all();
}
