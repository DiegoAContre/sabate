import { and, eq, gte, sql } from 'drizzle-orm';
import {
  db,
  productSizes,
  products,
  saleItems,
  sales,
  stockMovements,
  type Sale,
  type SaleItem,
} from '@/db/client';
import type { PaymentMethod } from '@/lib/payment';
import { getCurrentRate } from '@/lib/rate';
import { DEFAULT_SIZE, normalizeSize } from '@/lib/product';

/** Business rule refusal — the route maps `status` to the HTTP code. */
export class SaleError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}

export interface SaleLineInput {
  productId: string;
  size: string;
  quantity: number;
}

export interface CreateSaleInput {
  userId: string;
  items: SaleLineInput[];
  paymentMethod: PaymentMethod;
  /** Bank reference for transferencia / pago_movil (optional). */
  reference?: string;
}

/**
 * Sells a ticket. Prices always come from the DB (never from the client) and
 * the day's rate is snapshotted so the receipt and reports reproduce the Bs
 * total exactly. All-or-nothing: a line without stock rolls the sale back.
 */
export async function createSale({
  userId,
  items,
  paymentMethod,
  reference,
}: CreateSaleInput): Promise<{ sale: Sale; items: SaleItem[] }> {
  const rate = await getCurrentRate();
  if (!rate || !rate.isValid) {
    throw new SaleError(
      'No hay tasa vigente. Establece la tasa del día antes de vender.',
    );
  }

  return db.transaction((tx) => {
    let total = 0;
    const lines: {
      productId: string;
      productName: string;
      unitPrice: number;
      quantity: number;
      size: string;
    }[] = [];

    for (const item of items) {
      const product = tx
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .get();
      if (!product || !product.isActive) {
        throw new SaleError('Producto no disponible');
      }

      const size = normalizeSize(item.size);
      // Conditional decrement on the size: the guard and the write are one
      // statement, so concurrent tickets can't oversell a size.
      const [updated] = tx
        .update(productSizes)
        .set({ quantity: sql`${productSizes.quantity} - ${item.quantity}` })
        .where(
          and(
            eq(productSizes.productId, item.productId),
            eq(productSizes.size, size),
            gte(productSizes.quantity, item.quantity),
          ),
        )
        .returning()
        .all();
      if (!updated) {
        throw new SaleError(
          `Stock insuficiente: ${product.name} (talla ${size})`,
        );
      }

      total += product.price * item.quantity;
      lines.push({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
        size,
      });
    }

    const [sale] = tx
      .insert(sales)
      .values({
        userId,
        total,
        paymentMethod,
        exchangeRate: rate.bsPerUsd,
        reference: reference?.trim() || null,
      })
      .returning()
      .all();

    const rows = lines.map((line) => {
      const [row] = tx
        .insert(saleItems)
        .values({ ...line, saleId: sale.id })
        .returning()
        .all();
      tx.insert(stockMovements)
        .values({
          productId: line.productId,
          delta: -line.quantity,
          reason: 'venta',
          userId,
          saleId: sale.id,
          size: line.size,
        })
        .run();
      return row;
    });

    // Refresh the denormalized total for every product touched.
    for (const productId of new Set(lines.map((l) => l.productId))) {
      tx.update(products)
        .set({
          stock: sql`(SELECT COALESCE(SUM(quantity), 0) FROM product_sizes WHERE product_id = ${productId})`,
        })
        .where(eq(products.id, productId))
        .run();
    }

    return { sale, items: rows };
  });
}

/**
 * Voids a sale: the row stays in the history (flagged) so the money trail is
 * never rewritten, the stock goes back, and each line leaves an `anulacion`
 * movement. Owner-only (the route enforces the role).
 */
export async function voidSale({
  saleId,
  userId,
}: {
  saleId: string;
  userId: string;
}) {
  return db.transaction((tx) => {
    const sale = tx.select().from(sales).where(eq(sales.id, saleId)).get();
    if (!sale) throw new SaleError('Venta no encontrada', 404);
    if (sale.voidedAt) throw new SaleError('La venta ya está anulada');

    const items = tx
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, saleId))
      .all();

    const [updated] = tx
      .update(sales)
      .set({ voidedAt: new Date(), voidedBy: userId })
      .where(eq(sales.id, saleId))
      .returning()
      .all();

    for (const item of items) {
      // productId is null only if the product row was deleted — never happens
      // (products are deactivated, not deleted).
      if (!item.productId) continue;
      const product = tx
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .get();
      if (!product) continue;

      // Sales made before sizes existed have no size — restock the default.
      const size = item.size ?? DEFAULT_SIZE;
      const row = tx
        .select()
        .from(productSizes)
        .where(
          and(
            eq(productSizes.productId, item.productId),
            eq(productSizes.size, size),
          ),
        )
        .get();
      if (row) {
        tx.update(productSizes)
          .set({ quantity: sql`${productSizes.quantity} + ${item.quantity}` })
          .where(eq(productSizes.id, row.id))
          .run();
      } else {
        tx.insert(productSizes)
          .values({ productId: item.productId, size, quantity: item.quantity })
          .run();
      }

      tx.insert(stockMovements)
        .values({
          productId: item.productId,
          delta: item.quantity,
          reason: 'anulacion',
          userId,
          saleId: sale.id,
          size,
        })
        .run();

      tx.update(products)
        .set({
          stock: sql`(SELECT COALESCE(SUM(quantity), 0) FROM product_sizes WHERE product_id = ${item.productId})`,
        })
        .where(eq(products.id, item.productId))
        .run();
    }

    return { sale: updated };
  });
}
