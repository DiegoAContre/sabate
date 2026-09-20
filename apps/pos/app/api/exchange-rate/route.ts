import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, exchangeRates } from '@/db/client';
import { getSession } from '@/lib/auth';
import { RATE_VALIDITY_MS } from '@/lib/rate';

const rateSchema = z.object({
  rate: z.number().positive('La tasa debe ser mayor a 0'),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const parsed = rateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  // Decimal Bs per USD → integer céntimos de Bs per USD.
  const bsPerUsd = Math.round(parsed.data.rate * 100);
  const [rate] = await db
    .insert(exchangeRates)
    .values({ bsPerUsd, userId: session.userId })
    .returning();

  return NextResponse.json(
    {
      rate,
      validUntil: new Date(rate.createdAt.getTime() + RATE_VALIDITY_MS).toISOString(),
    },
    { status: 201 },
  );
}
