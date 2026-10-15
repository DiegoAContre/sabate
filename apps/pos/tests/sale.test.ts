import { beforeAll, describe, expect, it } from 'vitest';
import {
  db,
  exchangeRates,
  productSizes,
  products,
  saleItems,
  sales,
  stockMovements,
  users,
} from '@/db/client';
import { formatBs } from '@/lib/format';
import { createSale, SaleError, voidSale } from '@/lib/sale';

const USER_ID = 'test-user';
const RATE = 910050; // 9100.50 Bs per USD

function reset() {
  db.delete(saleItems).run();
  db.delete(stockMovements).run();
  db.delete(productSizes).run();
  db.delete(sales).run();
  db.delete(exchangeRates).run();
  db.delete(products).run();
  db.delete(users).run();
  db.insert(users)
    .values({
      id: USER_ID,
      username: 'test',
      passwordHash: 'x',
      name: 'Test',
      role: 'seller',
    })
    .run();
}

function setRate(createdAt = new Date()) {
  db.insert(exchangeRates)
    .values({ bsPerUsd: RATE, userId: USER_ID, createdAt })
    .run();
}

/** Product with a `sizes` map (size → quantity); total goes into products.stock. */
function addProduct(name: string, price: number, sizes: Record<string, number>) {
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  const [p] = db
    .insert(products)
    .values({ name, price, stock: total })
    .returning()
    .all();
  for (const [size, quantity] of Object.entries(sizes)) {
    db.insert(productSizes).values({ productId: p.id, size, quantity }).run();
  }
  return p;
}

const stockOf = (productId: string, size: string) =>
  db
    .select()
    .from(productSizes)
    .all()
    .find((s) => s.productId === productId && s.size === size)?.quantity;
const totalStock = (productId: string) =>
  db.select().from(products).all().find((p) => p.id === productId)?.stock;
const saleCount = () => db.select().from(sales).all().length;
const itemCount = () => db.select().from(saleItems).all().length;
const movementCount = () => db.select().from(stockMovements).all().length;

describe('createSale', () => {
  beforeAll(reset);

  it('sells a size: totals from DB prices, snapshots rate, decrements that size', async () => {
    reset();
    setRate();
    const shirt = addProduct('Camisa', 250, { S: 2, M: 3 });
    const cafe = addProduct('Café', 100, { ÚNICA: 1 });

    const { sale, items } = await createSale({
      userId: USER_ID,
      items: [
        { productId: shirt.id, size: 'M', quantity: 2 },
        { productId: cafe.id, size: 'ÚNICA', quantity: 1 },
      ],
      paymentMethod: 'efectivo',
    });

    expect(sale.total).toBe(600);
    expect(sale.exchangeRate).toBe(RATE);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      productName: 'Camisa',
      unitPrice: 250,
      quantity: 2,
      size: 'M',
    });

    // Only the sold size moved; the total is the sum of the sizes.
    expect(stockOf(shirt.id, 'M')).toBe(1);
    expect(stockOf(shirt.id, 'S')).toBe(2);
    expect(totalStock(shirt.id)).toBe(3);
    expect(totalStock(cafe.id)).toBe(0);

    const movements = db.select().from(stockMovements).all();
    expect(movements).toHaveLength(2);
    expect(movements[0]).toMatchObject({
      delta: -2,
      reason: 'venta',
      saleId: sale.id,
      size: 'M',
    });
  });

  it('normalizes the size (lowercase input matches stored uppercase)', async () => {
    reset();
    setRate();
    const shirt = addProduct('Camisa', 100, { M: 5 });

    await createSale({
      userId: USER_ID,
      items: [{ productId: shirt.id, size: 'm', quantity: 1 }],
      paymentMethod: 'efectivo',
    });

    expect(stockOf(shirt.id, 'M')).toBe(4);
  });

  it('refuses a size without stock and writes nothing', async () => {
    reset();
    setRate();
    const shirt = addProduct('Camisa', 250, { S: 5, M: 1 });

    await expect(
      createSale({
        userId: USER_ID,
        items: [
          { productId: shirt.id, size: 'S', quantity: 1 },
          { productId: shirt.id, size: 'M', quantity: 2 },
        ],
        paymentMethod: 'tarjeta',
      }),
    ).rejects.toThrow(SaleError);

    // No partial sale: the first line's decrement was rolled back.
    expect(stockOf(shirt.id, 'S')).toBe(5);
    expect(stockOf(shirt.id, 'M')).toBe(1);
    expect(totalStock(shirt.id)).toBe(6);
    expect(saleCount()).toBe(0);
    expect(itemCount()).toBe(0);
    expect(movementCount()).toBe(0);
  });

  it('refuses a size the product does not have', async () => {
    reset();
    setRate();
    const shirt = addProduct('Camisa', 250, { S: 5 });

    await expect(
      createSale({
        userId: USER_ID,
        items: [{ productId: shirt.id, size: 'XL', quantity: 1 }],
        paymentMethod: 'efectivo',
      }),
    ).rejects.toThrow(/Stock insuficiente/);
    expect(saleCount()).toBe(0);
  });

  it('refuses to sell on an expired rate', async () => {
    reset();
    setRate(new Date(Date.now() - 13 * 60 * 60 * 1000));
    const shirt = addProduct('Camisa', 250, { M: 5 });

    await expect(
      createSale({
        userId: USER_ID,
        items: [{ productId: shirt.id, size: 'M', quantity: 1 }],
        paymentMethod: 'efectivo',
      }),
    ).rejects.toThrow(/tasa/i);

    expect(saleCount()).toBe(0);
  });

  it('refuses to sell with no rate at all', async () => {
    reset();
    const shirt = addProduct('Camisa', 250, { M: 5 });

    await expect(
      createSale({
        userId: USER_ID,
        items: [{ productId: shirt.id, size: 'M', quantity: 1 }],
        paymentMethod: 'efectivo',
      }),
    ).rejects.toThrow(SaleError);
  });

  it('converts the total to Bs at the snapshotted rate', () => {
    expect(formatBs(600, RATE)).toBe('Bs 54.603,00');
  });

  it('stores the payment reference (pago_movil) and null when absent', async () => {
    reset();
    setRate();
    const shirt = addProduct('Camisa', 250, { M: 5 });

    const { sale } = await createSale({
      userId: USER_ID,
      items: [{ productId: shirt.id, size: 'M', quantity: 1 }],
      paymentMethod: 'pago_movil',
      reference: '  0012345678  ',
    });
    expect(sale.paymentMethod).toBe('pago_movil');
    expect(sale.reference).toBe('0012345678');

    const { sale: sinRef } = await createSale({
      userId: USER_ID,
      items: [{ productId: shirt.id, size: 'M', quantity: 1 }],
      paymentMethod: 'efectivo',
    });
    expect(sinRef.reference).toBeNull();
  });

  it('voids a sale: restocks the size, records anulacion and keeps the row', async () => {
    reset();
    setRate();
    const shirt = addProduct('Camisa', 250, { M: 5 });

    const { sale } = await createSale({
      userId: USER_ID,
      items: [{ productId: shirt.id, size: 'M', quantity: 2 }],
      paymentMethod: 'efectivo',
    });
    const { sale: voided } = await voidSale({
      saleId: sale.id,
      userId: USER_ID,
    });

    expect(voided.voidedAt).toBeInstanceOf(Date);
    expect(voided.voidedBy).toBe(USER_ID);
    // Stock came back and the history stayed put.
    expect(stockOf(shirt.id, 'M')).toBe(5);
    expect(totalStock(shirt.id)).toBe(5);
    expect(saleCount()).toBe(1);

    const anulacion = db
      .select()
      .from(stockMovements)
      .all()
      .filter((m) => m.reason === 'anulacion');
    expect(anulacion).toHaveLength(1);
    expect(anulacion[0]).toMatchObject({ delta: 2, saleId: sale.id, size: 'M' });
  });

  it('refuses to void twice and to void an unknown sale', async () => {
    reset();
    setRate();
    const shirt = addProduct('Camisa', 250, { M: 5 });
    const { sale } = await createSale({
      userId: USER_ID,
      items: [{ productId: shirt.id, size: 'M', quantity: 1 }],
      paymentMethod: 'efectivo',
    });
    await voidSale({ saleId: sale.id, userId: USER_ID });

    await expect(
      voidSale({ saleId: sale.id, userId: USER_ID }),
    ).rejects.toThrow(/ya está anulada/);
    await expect(
      voidSale({ saleId: 'no-existe', userId: USER_ID }),
    ).rejects.toThrow(SaleError);
  });
});
