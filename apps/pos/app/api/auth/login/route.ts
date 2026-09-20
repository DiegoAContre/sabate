import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, users } from '@/db/client';
import { createToken } from '@/lib/token';

const loginSchema = z.object({
  username: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.username, parsed.data.username),
  });
  const valid =
    user &&
    user.isActive &&
    (await bcrypt.compare(parsed.data.password, user.passwordHash));

  if (!user || !valid) {
    return NextResponse.json(
      { error: 'Usuario o contraseña incorrectos' },
      { status: 401 },
    );
  }

  const token = await createToken({
    userId: user.id,
    name: user.name,
    role: user.role,
  });

  const res = NextResponse.json({
    user: { name: user.name, role: user.role },
  });
  res.cookies.set('pos_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
