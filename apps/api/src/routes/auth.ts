import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, users } from '@sabate/db';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';
import { loginSchema, registerSchema, updateProfileSchema, changePasswordSchema } from '../validators/auth.js';
import {
  loginUser,
  registerUser,
  updateProfile,
  changePassword,
} from '../services/authService.js';

export const authRouter = Router();

authRouter.post(
  '/api/auth/register',
  authLimiter,
  validate(registerSchema),
  async (req, res) => {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  },
);

authRouter.post(
  '/api/auth/login',
  authLimiter,
  validate(loginSchema),
  async (req, res) => {
    const result = await loginUser(req.body);
    res.status(200).json(result);
  },
);

authRouter.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, req.user!.sub),
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const { passwordHash: _, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword });
});

authRouter.patch(
  '/api/auth/me',
  authMiddleware,
  validate(updateProfileSchema),
  async (req, res) => {
    const user = await updateProfile(req.user!.sub, req.body);
    res.json({ user });
  },
);

authRouter.post(
  '/api/auth/change-password',
  authMiddleware,
  authLimiter,
  validate(changePasswordSchema),
  async (req, res) => {
    await changePassword(req.user!.sub, req.body);
    res.json({ ok: true });
  },
);
