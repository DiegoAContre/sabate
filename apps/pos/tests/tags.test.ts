import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  brands,
  categories,
  exchangeRates,
  products,
  saleItems,
  sales,
  stockMovements,
  users,
} from '@/db/client';
import {
  TagError,
  createTag,
  deleteTag,
  listTags,
  renameTag,
  tagExists,
} from '@/lib/tags';

const USER_ID = 'tag-user';

function reset() {
  // Shared test DB: sale.test.ts leaves rows behind, and every table FKs users.
  db.delete(saleItems).run();
  db.delete(stockMovements).run();
  db.delete(sales).run();
  db.delete(exchangeRates).run();
  db.delete(products).run();
  db.delete(categories).run();
  db.delete(brands).run();
  db.delete(users).run();
  db.insert(users)
    .values({
      id: USER_ID,
      username: 'tag',
      passwordHash: 'x',
      name: 'Tag',
      role: 'owner',
    })
    .run();
}

function addProduct(name: string, categoryId?: string, brandId?: string) {
  const [p] = db
    .insert(products)
    .values({ name, price: 100, stock: 1, categoryId, brandId })
    .returning()
    .all();
  return p;
}

describe('tags', () => {
  beforeEach(reset);

  it('creates and lists each kind separately', () => {
    const zapato = createTag('category', '  Zapato  ');
    createTag('brand', 'adidas');

    expect(zapato.name).toBe('Zapato');
    expect(listTags('category').map((c) => c.name)).toEqual(['Zapato']);
    expect(listTags('brand').map((b) => b.name)).toEqual(['adidas']);
    expect(tagExists('category', zapato.id)).toBe(true);
    expect(tagExists('brand', zapato.id)).toBe(false);
  });

  it('refuses a duplicate ignoring case and spaces', () => {
    createTag('category', 'Medias');
    expect(() => createTag('category', '  medias ')).toThrow(TagError);
    expect(listTags('category')).toHaveLength(1);
  });

  it('renames, but not onto an existing name', () => {
    const camisa = createTag('category', 'Camisa');
    createTag('category', 'Zapato');

    expect(renameTag('category', camisa.id, 'Camisa de vestir').name).toBe(
      'Camisa de vestir',
    );
    expect(() => renameTag('category', camisa.id, 'ZAPATO')).toThrow(TagError);
  });

  it('reports a missing value as 404', () => {
    try {
      deleteTag('brand', 'no-existe');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(TagError);
      expect((err as TagError).status).toBe(404);
    }
  });

  it('refuses to delete a value a product uses and allows a free one', () => {
    const zapato = createTag('category', 'Zapato');
    const ke = createTag('brand', 'ke');
    const libre = createTag('brand', 'nadie');
    addProduct('Zapato ke 42', zapato.id, ke.id);

    expect(() => deleteTag('category', zapato.id)).toThrow(/En uso por 1/);
    expect(() => deleteTag('brand', ke.id)).toThrow(TagError);

    deleteTag('brand', libre.id);
    expect(listTags('brand').map((b) => b.name)).toEqual(['ke']);
  });
});
