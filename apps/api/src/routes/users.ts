import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { updateUserSchema, userIdParamSchema } from '../validators/users.js';
import { listUsers, updateUser } from '../services/userService.js';

export const usersRouter = Router();

usersRouter.get(
  '/api/admin/users',
  authMiddleware,
  requireRole('admin'),
  async (_req, res) => {
    const users = await listUsers();
    res.json({ users });
  },
);

usersRouter.patch(
  '/api/admin/users/:id',
  authMiddleware,
  requireRole('admin'),
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema),
  async (req, res) => {
    const { id } = (req as unknown as Record<string, unknown>)
      .validatedParams as { id: string };
    const user = await updateUser(id, req.body, req.user!.sub);
    res.json({ user });
  },
);
