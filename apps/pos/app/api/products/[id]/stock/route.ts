import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, products, stockMovements } from '@/db/client';
import { getSession } from '@/lib/auth';

// Receive: how many arrived (+N). Adjust: the counted real total (delta computed).
const stockSchema = z.discriminatedUnion('reason', [
  z.object({
    reason: z.literal('recepcion'),
    quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
    note: z.string().optional(),
  }),
  z.object({
    reason: z.literal('ajuste'),
    newStock: z.number().int().nonnegative('El total no puede ser negativo'),
    note: z.string().optional(),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = stockSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const result = db.transaction((tx) => {
    const product = tx.select().from(products).where(eq(products.id, id)).get();
    if (!product) return { error: 'Producto no encontrado' as const };

    const delta =
      data.reason === 'recepcion'
        ? data.quantity
        : data.newStock - product.stock;

    if (delta === 0) return { product }; // nothing to record

    const [updated] = tx
      .update(products)
      .set({ stock: product.stock + delta })
      .where(eq(products.id, id))
      .returning()
      .all();
    tx.insert(stockMovements)
      .values({
        productId: id,
        delta,
        reason: data.reason,
        userId: session.userId,
        note: data.note || null,
      })
      .run();
    return { product: updated };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ product: result.product });
}
