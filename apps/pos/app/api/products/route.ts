import { asc, eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, products, stockMovements } from '@/db/client';
import { getSession } from '@/lib/auth';
import { tagExists } from '@/lib/tags';

const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  categoryId: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  price: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});

export async function GET(req: NextRequest) {
  const includeInactive = req.nextUrl.searchParams.get('all') === '1';
  const rows = await db
    .select()
    .from(products)
    .where(includeInactive ? undefined : eq(products.isActive, true))
    .orderBy(asc(products.name));
  return NextResponse.json({ products: rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const parsed = productSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }
  const data = parsed.data;
  if (data.categoryId && !tagExists('category', data.categoryId)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
  }
  if (data.brandId && !tagExists('brand', data.brandId)) {
    return NextResponse.json({ error: 'Marca inválida' }, { status: 400 });
  }

  const product = db.transaction((tx) => {
    const [created] = tx
      .insert(products)
      .values({
        name: data.name,
        categoryId: data.categoryId || null,
        brandId: data.brandId || null,
        price: data.price,
        stock: data.stock,
        lowStockThreshold: data.lowStockThreshold,
      })
      .returning()
      .all();
    // Initial stock is a recepción — audit from day one.
    if (data.stock > 0) {
      tx.insert(stockMovements)
        .values({
          productId: created.id,
          delta: data.stock,
          reason: 'recepcion',
          userId: session.userId,
          note: 'Stock inicial',
        })
        .run();
    }
    return created;
  });

  return NextResponse.json({ product }, { status: 201 });
}
