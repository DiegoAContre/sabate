import { beforeEach, describe, expect, it } from 'vitest';
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
import {
  adjustSize,
  createProduct,
  listProductSizes,
  receiveSize,
  updateProduct,
} from '@/lib/product';

const USER_ID = 'prod-user';

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
      username: 'prod',
      passwordHash: 'x',
      name: 'Prod',
      role: 'owner',
    })
    .run();
}

const getProduct = (id: string) =>
  db.select().from(products).all().find((p) => p.id === id)!;
const quantityOf = (id: string, size: string) =>
  listProductSizes(id).find((s) => s.size === size)?.quantity;
const movements = () => db.select().from(stockMovements).all();

describe('product sizes', () => {
  beforeEach(reset);

  it('creates a product with sizes, code and a recomputed total', () => {
    const p = createProduct({
      userId: USER_ID,
      name: 'Camisa',
      code: '  CM-01 ',
      price: 250,
      lowStockThreshold: 2,
      sizes: [
        { size: 's', quantity: 2 },
        { size: 'm', quantity: 3 },
      ],
    });

    expect(p.code).toBe('CM-01');
    expect(p.stock).toBe(5);
    expect(quantityOf(p.id, 'S')).toBe(2);
    expect(quantityOf(p.id, 'M')).toBe(3);
    expect(movements().map((m) => m.reason)).toEqual(['recepcion', 'recepcion']);
    expect(movements().every((m) => m.delta > 0)).toBe(true);
  });

  it('stores no code when it is empty or whitespace', () => {
    const p = createProduct({
      userId: USER_ID,
      name: 'Gorra',
      code: '   ',
      price: 100,
      lowStockThreshold: 5,
      sizes: [{ size: 'ÚNICA', quantity: 1 }],
    });
    expect(p.code).toBeNull();
  });

  it('receiveSize adds to one size and recomputes the total', () => {
    const p = createProduct({
      userId: USER_ID,
      name: 'Camisa',
      price: 250,
      lowStockThreshold: 2,
      sizes: [{ size: 'M', quantity: 2 }],
    });

    receiveSize(p.id, USER_ID, 'm', 3, 'llegó mercancía');

    expect(quantityOf(p.id, 'M')).toBe(5);
    expect(getProduct(p.id).stock).toBe(5);
    const last = movements().at(-1)!;
    expect(last).toMatchObject({ reason: 'recepcion', delta: 3, size: 'M' });
  });

  it('adjustSize sets the counted total and logs the delta', () => {
    const p = createProduct({
      userId: USER_ID,
      name: 'Camisa',
      price: 250,
      lowStockThreshold: 2,
      sizes: [{ size: 'M', quantity: 5 }],
    });

    adjustSize(p.id, USER_ID, 'M', 2);

    expect(quantityOf(p.id, 'M')).toBe(2);
    expect(getProduct(p.id).stock).toBe(2);
    expect(movements().at(-1)).toMatchObject({
      reason: 'ajuste',
      delta: -3,
      size: 'M',
    });
  });

  it('updateProduct reconciles the size list (add, change, remove)', () => {
    const p = createProduct({
      userId: USER_ID,
      name: 'Camisa',
      price: 250,
      lowStockThreshold: 2,
      sizes: [
        { size: 'S', quantity: 1 },
        { size: 'M', quantity: 3 },
      ],
    });

    const updated = updateProduct(p.id, {
      userId: USER_ID,
      name: 'Camisa nueva',
      sizes: [
        { size: 'M', quantity: 0 },
        { size: 'L', quantity: 2 },
      ],
    });

    expect(updated!.name).toBe('Camisa nueva');
    expect(quantityOf(p.id, 'S')).toBeUndefined();
    expect(quantityOf(p.id, 'M')).toBe(0);
    expect(quantityOf(p.id, 'L')).toBe(2);
    expect(updated!.stock).toBe(2);
  });

  it('returns null when updating an unknown product', () => {
    expect(updateProduct('no-existe', { userId: USER_ID, name: 'X' })).toBeNull();
  });
});
