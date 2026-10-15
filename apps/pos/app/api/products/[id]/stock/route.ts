import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, products } from '@/db/client';
import { getSession } from '@/lib/auth';
import { adjustSize, receiveSize } from '@/lib/product';

// Receive: how many arrived (+N). Adjust: the counted real total (delta computed).
const stockSchema = z.discriminatedUnion('reason', [
  z.object({
    reason: z.literal('recepcion'),
    size: z.string().trim().min(1, 'Talla requerida').max(20),
    quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
    note: z.string().optional(),
  }),
  z.object({
    reason: z.literal('ajuste'),
    size: z.string().trim().min(1, 'Talla requerida').max(20),
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

  const product = db.select().from(products).where(eq(products.id, id)).get();
  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
  }

  if (data.reason === 'recepcion') {
    receiveSize(id, session.userId, data.size, data.quantity, data.note);
  } else {
    adjustSize(id, session.userId, data.size, data.newStock, data.note);
  }

  const updated = db.select().from(products).where(eq(products.id, id)).get();
  return NextResponse.json({ product: updated });
}
