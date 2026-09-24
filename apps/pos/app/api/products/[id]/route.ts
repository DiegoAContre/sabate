import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, products } from '@/db/client';
import { getSession } from '@/lib/auth';
import { tagExists } from '@/lib/tags';

const updateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').optional(),
  categoryId: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  price: z.number().int().nonnegative().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
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

  const updates = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const [product] = await db
    .update(products)
    .set(updates)
    .where(eq(products.id, id))
    .returning();
  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ product });
}
