import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { tagExists } from '@/lib/tags';
import { normalizeSize, updateProduct } from '@/lib/product';

const sizeSchema = z.object({
  size: z.string().trim().min(1, 'Talla requerida').max(20),
  quantity: z.number().int().nonnegative('La cantidad no puede ser negativa'),
});

const updateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').optional(),
  code: z.string().trim().max(40).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  price: z.number().int().nonnegative().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  sizes: z.array(sizeSchema).min(1, 'Agrega al menos una talla').optional(),
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
  if (data.sizes) {
    const names = data.sizes.map((s) => normalizeSize(s.size));
    if (new Set(names).size !== names.length) {
      return NextResponse.json({ error: 'Hay tallas repetidas' }, { status: 400 });
    }
  }

  const product = updateProduct(id, { userId: session.userId, ...data });
  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ product });
}
