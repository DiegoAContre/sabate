import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { cartRouter } from './routes/cart.js';
import { catalogRouter } from './routes/catalog.js';
import { checkoutRouter } from './routes/checkout.js';
import { healthRouter } from './routes/health.js';
import { webhookRouter } from './routes/webhooks.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

// Stripe webhook needs raw body — mount before express.json and generalLimiter
app.use(webhookRouter);

app.use(generalLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use(healthRouter);
app.use(authRouter);
app.use(catalogRouter);
app.use(cartRouter);
app.use(checkoutRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);
