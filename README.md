# sabate

E-commerce platform for a business in Sabate, Valera, Trujillo State.

## Tech Stack

| Layer       | Technology                       |
| ----------- | -------------------------------- |
| Frontend    | Next.js 15 (App Router)          |
| Styling     | Tailwind CSS                     |
| Backend     | Express 5 (separate API server) |
| Database    | PostgreSQL                       |
| ORM         | Drizzle                          |
| Auth        | NextAuth.js (Auth.js)            |
| Payments    | Stripe                           |
| Images      | AWS S3                           |
| Hosting     | AWS EC2 (free tier → paid tier)  |

## Architecture

This is a monorepo with three packages:

```
apps/web       → Next.js frontend (App Router, Tailwind)
apps/api       → Express 5 REST API
packages/db    → Drizzle schema, migrations, shared DB client
```

Next.js calls the Express API for all data operations — **no API routes or server actions for business logic** in the web app.

## Getting Started

```bash
# 1. Install all workspaces
npm install

# 2. Start the database
docker compose up db -d

# 3. Copy and fill in the env files from .env.example
#    At minimum, set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in apps/api/.env

# 4. Apply migrations and seed (admin user + sample categories)
npm run db:migrate
npm run seed

# 5. Run both apps (API :3001, web :3000)
npm run dev
```

Run commands:

- `npm run dev` / `npm run dev -w apps/api` / `npm run dev -w apps/web` — run apps
- `npm run typecheck` — tsc across all workspaces
- `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` — Drizzle workflow
- `npm run seed` — seed admin + categories
- `npm run test` / `npm run test:db-setup` — see Testing below

### Stripe (local dev)

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `apps/api/.env`, then forward
webhooks locally (requires [Stripe CLI](https://docs.stripe.com/stripe-cli)):

```bash
stripe listen --forward-to localhost:3001/api/webhooks/stripe
stripe trigger checkout.session.completed   # manual webhook smoke test
```

### S3 (admin image uploads)

Set the optional `S3_BUCKET` + `AWS_*` vars in `apps/api/.env` to enable admin
product image uploads.

## Testing

Tests run in `apps/api` (vitest) against a dedicated `sabate_test` database in the
same docker container — dev data is never touched.

```bash
npm run test:db-setup   # one-time (idempotent): creates `sabate_test` + pushes schema
npm run test            # checkout/webhook idempotency, auth, cart
```

The test env is network-free (Stripe keys blanked) and test files run sequentially
because they share the database.

## Environment

Each app has its own env file (see `.env.example` in the repo root):

- `apps/api/.env` — `PORT`, `JWT_SECRET`, `CORS_ORIGIN`, `DATABASE_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `STRIPE_SECRET_KEY` (optional), `STRIPE_WEBHOOK_SECRET` (optional), `S3_BUCKET` (optional), `AWS_ACCESS_KEY_ID` (optional), `AWS_SECRET_ACCESS_KEY` (optional), `AWS_REGION` (optional)
- `apps/web/.env.local` — `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `packages/db/.env` — `DATABASE_URL`

## Deploy to AWS

**Free tier setup:**
- EC2 t2.micro (750 hrs/month for 12 months)
- RDS PostgreSQL db.t3.micro (free tier)
- nginx reverse proxy → Express on port 3001, Next.js on port 3000
- PM2 process manager for both apps

**Roadmap:**
1. Launch on free tier with single EC2 instance
2. Migrate to paid tier (larger instances, RDS scaling) as traffic grows
3. Add CloudFront CDN in front of S3 and the EC2 box, load balancer if needed

## Features

- Product listing with search, filter, pagination, sort
- Shopping cart and Stripe checkout
- User profile management (`/account`: name, password, avatar)
- Customer order history (`/account/orders`)
- Admin panel: manage products, categories, users, and orders (status updates)
- Race-safe inventory (non-negative stock enforced by DB constraint, idempotent checkout webhooks, admin notification on stock shortfalls)
- Multiple image uploads via AWS S3

## License

Private
