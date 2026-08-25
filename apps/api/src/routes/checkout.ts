import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { checkoutSchema } from '../validators/checkout.js';
import { createCheckoutSession } from '../services/checkoutService.js';

export const checkoutRouter = Router();

checkoutRouter.post(
  '/api/checkout',
  authMiddleware,
  validate(checkoutSchema),
  async (req, res) => {
    const result = await createCheckoutSession(req.user!.sub, req.body);
    res.json(result);
  },
);
