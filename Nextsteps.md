# Next steps (in suggested order)

## 1. Stripe end-to-end pass (recommended first)

No code — validates the real money flow end to end. The webhook handler has only been
tested with fake sessions so far.

```bash
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

- Pay with test card `4242 4242 4242 4242` (any future date, any CVC).
- Verify: order flips `pending → paid`, product stock decremented, cart cleared,
  Stripe payment intent id stored on the order.
- Retry a webhook delivery (Stripe CLI `stripe trigger` or dashboard resend) and confirm
  idempotency — no double stock decrement.

## 2. Automated tests

No test framework exists; everything is verified by hand via curl.

- Add `vitest` to `apps/api`, running against the local docker DB.
- Port the inventory smoke checks into a real test file: atomic webhook claim,
  conditional stock decrement, oversold flag, CHECK constraint, checkout 409.
- Add basics for auth (register/login/change-password) and cart (stock-capped add/update).

## 3. Deployment checklist

The app has never run in production mode.

- Prod `.env` values on the EC2 (real `JWT_SECRET`, `CORS_ORIGIN`, Stripe live keys).
- PM2 startup + logs, nginx vhosts for ports 3000/3001, HTTPS cert.
- `npm run seed` on prod DB with `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` from env.
- Smoke: register, buy (live mode test card first), webhook received.

## 4. UX polish (optional)

- Cart item-count badge in the navbar.
- Order confirmation email (needs an email provider — real scope, plan first).
- Admin order detail page (skipped by choice — list page covers it for now).
