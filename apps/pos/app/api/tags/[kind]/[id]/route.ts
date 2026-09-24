import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { TagError, deleteTag, isTagKind, renameTag } from '@/lib/tags';

const updateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { kind, id } = await params;
  if (!isTagKind(kind)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({ item: renameTag(kind, id, parsed.data.name) });
  } catch (err) {
    if (err instanceof TagError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { kind, id } = await params;
  if (!isTagKind(kind)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 404 });
  }

  try {
    deleteTag(kind, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TagError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
