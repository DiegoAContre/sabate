import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { TagError, createTag, isTagKind, listTags } from '@/lib/tags';

const createSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (!isTagKind(kind)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 404 });
  }
  return NextResponse.json({ items: listTags(kind) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { kind } = await params;
  if (!isTagKind(kind)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 404 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ item: createTag(kind, parsed.data.name) }, { status: 201 });
  } catch (err) {
    if (err instanceof TagError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
