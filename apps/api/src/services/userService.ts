import { and, asc, count, eq } from 'drizzle-orm';
import { db, users } from '@sabate/db';
import { AppError } from '../utils/AppError.js';
import type { UpdateUserInput } from '../validators/users.js';

type User = typeof users.$inferSelect;

export type PublicUser = Omit<User, 'passwordHash'>;

function stripPasswordHash(user: User): PublicUser {
  const { passwordHash: _, ...rest } = user;
  return rest;
}

export async function listUsers(): Promise<PublicUser[]> {
  const result = await db.select().from(users).orderBy(asc(users.createdAt));
  return result.map(stripPasswordHash);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actingUserId: string,
): Promise<PublicUser> {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, id),
  });
  if (!existing) {
    throw new AppError('User not found', 404);
  }

  const demoting = input.role !== undefined && input.role !== 'admin' && existing.role === 'admin';
  const deactivating = input.isActive === false && existing.isActive;
  const isActiveAdmin = existing.role === 'admin' && existing.isActive;

  if (id === actingUserId && (demoting || deactivating)) {
    throw new AppError('You cannot change your own role or deactivate your own account', 400);
  }

  if (isActiveAdmin && (demoting || deactivating)) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));
    if (Number(total) <= 1) {
      throw new AppError('Cannot remove the last active admin', 400);
    }
  }

  const [user] = await db
    .update(users)
    .set({
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  return stripPasswordHash(user);
}
