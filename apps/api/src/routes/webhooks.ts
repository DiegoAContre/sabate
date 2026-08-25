import { Router } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';
import { handleCheckoutCompleted } from '../services/checkoutService.js';

export const webhookRouter = Router();

webhookRouter.post(
  '/api/webhooks/stripe',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string | undefined;

    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !sig) {
      res.status(400).json({ error: 'Webhook not configured' });
      return;
    }

    let event: Stripe.Event;
    try {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
    }

    res.json({ received: true });
  },
);
