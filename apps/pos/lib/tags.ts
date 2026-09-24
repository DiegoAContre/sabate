import { count, eq, sql } from 'drizzle-orm';
import { db, brands, categories, products } from '@/db/client';

// Two pick-lists, one code path: `kind` picks the table and the products column.
export const TAG_KINDS = ['category', 'brand'] as const;
export type TagKind = (typeof TAG_KINDS)[number];

export const TAG_LABELS: Record<TagKind, string> = {
  category: 'Categoría',
  brand: 'Marca',
};

export function isTagKind(value: string): value is TagKind {
  return (TAG_KINDS as readonly string[]).includes(value);
}

const TABLES = {
  category: { table: categories, fk: products.categoryId },
  brand: { table: brands, fk: products.brandId },
} as const;

/** Names are unique ignoring case and surrounding spaces. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export class TagError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}

function findByName(kind: TagKind, name: string) {
  const { table } = TABLES[kind];
  const [row] = db
    .select()
    .from(table)
    .where(sql`lower(${table.name}) = lower(${normalizeName(name)})`)
    .limit(1)
    .all();
  return row;
}

export function listTags(kind: TagKind) {
  const { table } = TABLES[kind];
  return db.select().from(table).orderBy(table.name).all();
}

export function tagExists(kind: TagKind, id: string): boolean {
  const { table } = TABLES[kind];
  const [row] = db.select().from(table).where(eq(table.id, id)).limit(1).all();
  return Boolean(row);
}

export function createTag(kind: TagKind, rawName: string) {
  const name = normalizeName(rawName);
  if (!name) throw new TagError('El nombre es requerido', 400);
  const clash = findByName(kind, name);
  if (clash) throw new TagError(`Ya existe «${clash.name}»`);

  const { table } = TABLES[kind];
  const [created] = db.insert(table).values({ name }).returning().all();
  return created;
}

export function renameTag(kind: TagKind, id: string, rawName: string) {
  const name = normalizeName(rawName);
  if (!name) throw new TagError('El nombre es requerido', 400);

  const { table } = TABLES[kind];
  const [current] = db.select().from(table).where(eq(table.id, id)).limit(1).all();
  if (!current) throw new TagError('No encontrado', 404);

  const clash = findByName(kind, name);
  if (clash && clash.id !== id) throw new TagError(`Ya existe «${clash.name}»`);

  const [updated] = db
    .update(table)
    .set({ name })
    .where(eq(table.id, id))
    .returning()
    .all();
  return updated;
}

/** Products are never deleted, so a value in use can't be removed either. */
export function deleteTag(kind: TagKind, id: string) {
  const { table, fk } = TABLES[kind];
  const [row] = db.select().from(table).where(eq(table.id, id)).limit(1).all();
  if (!row) throw new TagError('No encontrado', 404);

  const [used] = db
    .select({ n: count() })
    .from(products)
    .where(eq(fk, id))
    .all();
  if (used.n > 0) {
    throw new TagError(
      `En uso por ${used.n} ${used.n === 1 ? 'producto' : 'productos'}`,
    );
  }

  db.delete(table).where(eq(table.id, id)).run();
}
