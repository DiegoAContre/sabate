import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { categories, db, products } from '@sabate/db';
import { AppError } from '../utils/AppError.js';
import type { CategoryInput, ListProductsQuery, ProductInput } from '../validators/catalog.js';

type Category = typeof categories.$inferSelect;
type Product = typeof products.$inferSelect;

export async function listCategories(): Promise<Category[]> {
  return db.select().from(categories).orderBy(asc(categories.name));
}

export async function getCategoryBySlug(slug: string): Promise<Category> {
  const category = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
  });
  if (!category) {
    throw new AppError('Category not found', 404);
  }
  return category;
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  await assertCategorySlugUnique(input.slug);

  if (input.parentCategoryId) {
    await assertCategoryExists(input.parentCategoryId);
  }

  const [category] = await db
    .insert(categories)
    .values({
      name: input.name,
      slug: input.slug,
      parentCategoryId: input.parentCategoryId ?? null,
    })
    .returning();

  return category;
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  const existing = await db.query.categories.findFirst({
    where: eq(categories.id, id),
  });
  if (!existing) {
    throw new AppError('Category not found', 404);
  }

  if (input.slug !== existing.slug) {
    await assertCategorySlugUnique(input.slug, id);
  }

  if (input.parentCategoryId && input.parentCategoryId === id) {
    throw new AppError('A category cannot be its own parent', 400);
  }
  if (input.parentCategoryId) {
    await assertCategoryExists(input.parentCategoryId);
  }

  const [category] = await db
    .update(categories)
    .set({
      name: input.name,
      slug: input.slug,
      parentCategoryId: input.parentCategoryId ?? null,
    })
    .where(eq(categories.id, id))
    .returning();

  return category;
}

export async function deleteCategory(id: string): Promise<void> {
  const existing = await db.query.categories.findFirst({
    where: eq(categories.id, id),
  });
  if (!existing) {
    throw new AppError('Category not found', 404);
  }

  const subcategories = await db.$count(categories, eq(categories.parentCategoryId, id));
  const linkedProducts = await db.$count(products, eq(products.categoryId, id));
  if (subcategories > 0 || linkedProducts > 0) {
    throw new AppError(
      'Cannot delete category with subcategories or products. Reassign or delete them first.',
      400,
    );
  }

  await db.delete(categories).where(eq(categories.id, id));
}

export interface PaginatedProducts {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function listProducts(query: ListProductsQuery): Promise<PaginatedProducts> {
  const { page, limit, categoryId, search, sortBy, sortOrder } = query;
  const offset = (page - 1) * limit;

  const conditions = [eq(products.isActive, true)];
  if (categoryId) {
    conditions.push(eq(products.categoryId, categoryId));
  }
  if (search) {
    conditions.push(ilike(products.name, `%${search}%`));
  }

  const where = and(...conditions);

  const sortColumn =
    sortBy === 'price' ? products.price : sortBy === 'name' ? products.name : products.createdAt;
  const orderBy = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const [totalRows] = await db
    .select({ total: count() })
    .from(products)
    .where(where);
  const total = Number(totalRows.total);

  const data = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getProductBySlug(slug: string): Promise<Product> {
  const product = await db.query.products.findFirst({
    where: eq(products.slug, slug),
  });
  if (!product) {
    throw new AppError('Product not found', 404);
  }
  return product;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  await assertProductSlugUnique(input.slug);

  if (input.categoryId) {
    await assertCategoryExists(input.categoryId);
  }

  const [product] = await db
    .insert(products)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      stock: input.stock,
      categoryId: input.categoryId ?? null,
      images: input.images,
      isActive: input.isActive ?? true,
    })
    .returning();

  return product;
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const existing = await db.query.products.findFirst({
    where: eq(products.id, id),
  });
  if (!existing) {
    throw new AppError('Product not found', 404);
  }

  if (input.slug !== existing.slug) {
    await assertProductSlugUnique(input.slug, id);
  }

  if (input.categoryId) {
    await assertCategoryExists(input.categoryId);
  }

  const [product] = await db
    .update(products)
    .set({
      name: input.name,
      slug: input.slug,
      description: input.description ?? existing.description,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? existing.compareAtPrice,
      stock: input.stock,
      categoryId: input.categoryId ?? existing.categoryId,
      images: input.images,
      isActive: input.isActive ?? existing.isActive,
    })
    .where(eq(products.id, id))
    .returning();

  return product;
}

export async function deleteProduct(id: string): Promise<void> {
  const existing = await db.query.products.findFirst({
    where: eq(products.id, id),
  });
  if (!existing) {
    throw new AppError('Product not found', 404);
  }

  await db.delete(products).where(eq(products.id, id));
}

async function assertCategoryExists(id: string): Promise<void> {
  const category = await db.query.categories.findFirst({
    where: eq(categories.id, id),
  });
  if (!category) {
    throw new AppError('Parent category not found', 400);
  }
}

async function assertCategorySlugUnique(slug: string, excludeId?: string): Promise<void> {
  const existing = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
  });
  if (existing && (!excludeId || existing.id !== excludeId)) {
    throw new AppError('Category slug already in use', 409);
  }
}

async function assertProductSlugUnique(slug: string, excludeId?: string): Promise<void> {
  const existing = await db.query.products.findFirst({
    where: eq(products.slug, slug),
  });
  if (existing && (!excludeId || existing.id !== excludeId)) {
    throw new AppError('Product slug already in use', 409);
  }
}
