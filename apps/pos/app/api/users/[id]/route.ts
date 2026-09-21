import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, users } from '@/db/client';
import { getSession } from '@/lib/auth';

const updateSchema = z
  .object({
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.password !== undefined || d.isActive !== undefined, {
    message: 'Nada que actualizar',
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (session?.role !== 'owner') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 },
    );
  }

  const { id } = await params;
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) {
    return NextResponse.json(
      { error: 'Usuario no encontrado' },
      { status: 404 },
    );
  }

  if (parsed.data.isActive === false) {
    if (user.id === session.userId) {
      return NextResponse.json(
        { error: 'No puedes desactivarte a ti mismo' },
        { status: 400 },
      );
    }
    if (user.role === 'owner') {
      const owners = db
        .select()
        .from(users)
        .where(and(eq(users.role, 'owner'), eq(users.isActive, true)))
        .all();
      if (owners.length <= 1) {
        return NextResponse.json(
          { error: 'Debe quedar al menos un propietario activo' },
          { status: 400 },
        );
      }
    }
  }

  const [updated] = db
    .update(users)
    .set({
      ...(parsed.data.isActive !== undefined
        ? { isActive: parsed.data.isActive }
        : {}),
      ...(parsed.data.password
        ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) }
        : {}),
    })
    .where(eq(users.id, id))
    .returning()
    .all();

  return NextResponse.json({
    user: {
      id: updated!.id,
      username: updated!.username,
      name: updated!.name,
      role: updated!.role,
      isActive: updated!.isActive,
    },
  });
}
