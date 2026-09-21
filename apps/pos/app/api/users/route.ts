import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, users } from '@/db/client';
import { getSession } from '@/lib/auth';

const createSchema = z.object({
  username: z.string().trim().min(1, 'Usuario requerido'),
  name: z.string().trim().min(1, 'Nombre requerido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  const existing = db
    .select()
    .from(users)
    .where(eq(users.username, parsed.data.username))
    .get();
  if (existing) {
    return NextResponse.json(
      { error: 'Ya existe un usuario con ese nombre' },
      { status: 409 },
    );
  }

  const [user] = db
    .insert(users)
    .values({
      username: parsed.data.username,
      name: parsed.data.name,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: 'seller',
    })
    .returning()
    .all();

  return NextResponse.json(
    {
      user: {
        id: user!.id,
        username: user!.username,
        name: user!.name,
        role: user!.role,
        isActive: user!.isActive,
      },
    },
    { status: 201 },
  );
}
