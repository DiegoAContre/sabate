import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { PAYMENT_METHODS } from '@/lib/payment';
import { getSession } from '@/lib/auth';
import { createSale, SaleError } from '@/lib/sale';

const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
      }),
    )
    .min(1, 'Agrega al menos un producto'),
  paymentMethod: z.enum(PAYMENT_METHODS),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const parsed = saleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  try {
    const result = await createSale({
      userId: session.userId,
      items: parsed.data.items,
      paymentMethod: parsed.data.paymentMethod,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof SaleError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
