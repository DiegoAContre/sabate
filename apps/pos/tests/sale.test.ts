import { beforeAll, describe, expect, it } from 'vitest';
import {
  db,
  exchangeRates,
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

function addProduct(name: string, price: number, stock: number) {
  const [p] = db
    .insert(products)
    .values({ name, price, stock })
    .returning()
    .all();
  return p;
}

const saleCount = () => db.select().from(sales).all().length;
const itemCount = () => db.select().from(saleItems).all().length;
const movementCount = () => db.select().from(stockMovements).all().length;

describe('createSale', () => {
  beforeAll(reset);

  it('totals from DB prices, snapshots the rate and decrements stock', async () => {
    reset();
    setRate();
    const harina = addProduct('Harina', 250, 5);
    const cafe = addProduct('Café', 100, 2);

    const { sale, items } = await createSale({
      userId: USER_ID,
      items: [
        { productId: harina.id, quantity: 2 },
        { productId: cafe.id, quantity: 1 },
      ],
      paymentMethod: 'efectivo',
    });

    expect(sale.total).toBe(600);
    expect(sale.exchangeRate).toBe(RATE);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      productName: 'Harina',
      unitPrice: 250,
      quantity: 2,
    });

    expect(db.select().from(products).all()).toEqual([
      expect.objectContaining({ name: 'Harina', stock: 3 }),
      expect.objectContaining({ name: 'Café', stock: 1 }),
    ]);

    const movements = db.select().from(stockMovements).all();
    expect(movements).toHaveLength(2);
    expect(movements[0]).toMatchObject({
      delta: -2,
      reason: 'venta',
      saleId: sale.id,
    });
  });

  it('refuses a line without stock and writes nothing', async () => {
    reset();
    setRate();
    const harina = addProduct('Harina', 250, 5);
    const cafe = addProduct('Café', 100, 1);

    await expect(
      createSale({
        userId: USER_ID,
        items: [
          { productId: harina.id, quantity: 1 },
          { productId: cafe.id, quantity: 2 },
        ],
        paymentMethod: 'tarjeta',
      }),
    ).rejects.toThrow(SaleError);

    // No partial sale: the first line's decrement was rolled back.
    expect(db.select().from(products).all()).toEqual([
      expect.objectContaining({ stock: 5 }),
      expect.objectContaining({ stock: 1 }),
    ]);
    expect(saleCount()).toBe(0);
    expect(itemCount()).toBe(0);
    expect(movementCount()).toBe(0);
  });

  it('refuses to sell on an expired rate', async () => {
    reset();
    setRate(new Date(Date.now() - 13 * 60 * 60 * 1000));
    const harina = addProduct('Harina', 250, 5);

    await expect(
      createSale({
        userId: USER_ID,
        items: [{ productId: harina.id, quantity: 1 }],
        paymentMethod: 'efectivo',
      }),
    ).rejects.toThrow(/tasa/i);

    expect(saleCount()).toBe(0);
  });

  it('refuses to sell with no rate at all', async () => {
    reset();
    const harina = addProduct('Harina', 250, 5);

    await expect(
      createSale({
        userId: USER_ID,
        items: [{ productId: harina.id, quantity: 1 }],
        paymentMethod: 'efectivo',
      }),
    ).rejects.toThrow(SaleError);
  });

  it('converts the total to Bs at the snapshotted rate', () => {
    expect(formatBs(600, RATE)).toBe('Bs 54.603,00');
  });

  it('voids a sale: restocks, records anulacion and keeps the row', async () => {
    reset();
    setRate();
    const harina = addProduct('Harina', 250, 5);

    const { sale } = await createSale({
      userId: USER_ID,
      items: [{ productId: harina.id, quantity: 2 }],
      paymentMethod: 'efectivo',
    });
    const { sale: voided } = await voidSale({
      saleId: sale.id,
      userId: USER_ID,
    });

    expect(voided.voidedAt).toBeInstanceOf(Date);
    expect(voided.voidedBy).toBe(USER_ID);
    // Stock came back and the history stayed put.
    expect(db.select().from(products).all()[0]?.stock).toBe(5);
    expect(saleCount()).toBe(1);

    const anulacion = db
      .select()
      .from(stockMovements)
      .all()
      .filter((m) => m.reason === 'anulacion');
    expect(anulacion).toHaveLength(1);
    expect(anulacion[0]).toMatchObject({ delta: 2, saleId: sale.id });
  });

  it('refuses to void twice and to void an unknown sale', async () => {
    reset();
    setRate();
    const harina = addProduct('Harina', 250, 5);
    const { sale } = await createSale({
      userId: USER_ID,
      items: [{ productId: harina.id, quantity: 1 }],
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
