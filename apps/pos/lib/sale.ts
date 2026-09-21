import { and, eq, gte, sql } from 'drizzle-orm';
import {
  db,
  products,
  saleItems,
  sales,
  stockMovements,
  type Sale,
  type SaleItem,
} from '@/db/client';
import type { PaymentMethod } from '@/lib/payment';
import { getCurrentRate } from '@/lib/rate';

/** Business rule refusal — the route maps it to 409. */
export class SaleError extends Error {}

export interface SaleLineInput {
  productId: string;
  quantity: number;
}

export interface CreateSaleInput {
  userId: string;
  items: SaleLineInput[];
  paymentMethod: PaymentMethod;
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
      if (product.stock < item.quantity) {
        throw new SaleError(
          `Stock insuficiente: ${product.name} (queda ${product.stock})`,
        );
      }

      // Conditional decrement: the guard and the write are one statement.
      const [updated] = tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(
          and(
            eq(products.id, item.productId),
            gte(products.stock, item.quantity),
          ),
        )
        .returning()
        .all();
      if (!updated) {
        throw new SaleError(`Stock insuficiente: ${product.name}`);
      }

      total += product.price * item.quantity;
      lines.push({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
      });
    }

    const [sale] = tx
      .insert(sales)
      .values({ userId, total, paymentMethod, exchangeRate: rate.bsPerUsd })
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
        })
        .run();
      return row;
    });

    return { sale, items: rows };
  });
}
