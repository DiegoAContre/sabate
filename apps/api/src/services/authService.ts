import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db, users } from '@sabate/db';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import type {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from '../validators/auth.js';

const JWT_EXPIRES_IN = '3d';

type User = typeof users.$inferSelect;

export interface AuthResult {
  user: Omit<User, 'passwordHash'>;
  token: string;
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash,
      role: 'user',
    })
    .returning();

  const { passwordHash: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token: generateToken(user) };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }
  if (!user.isActive) {
    throw new AppError('Account disabled', 401);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid credentials', 401);
  }

  const { passwordHash: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token: generateToken(user) };
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<Omit<User, 'passwordHash'>> {
  const updates: Partial<Pick<User, 'name' | 'avatarUrl'>> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;

  const [user] = await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  const { passwordHash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError('Current password is incorrect', 401);
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

function generateToken(user: User): string {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}
