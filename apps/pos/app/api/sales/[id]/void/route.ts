import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { SaleError, voidSale } from '@/lib/sale';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const result = await voidSale({ saleId: id, userId: session.userId });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SaleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
