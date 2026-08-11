# AGENTS.md

## Architecture

Monorepo with three workspace packages:

```
apps/web/            Next.js 14+ (App Router) — frontend only, no API routes
apps/api/            Express.js — all business logic lives here
packages/db/         Drizzle schema, migrations, shared DB client
```

**The web app routes all data through the Express API.** Never add API routes or server actions to `apps/web`. Frontend calls `apps/api` over HTTP.

## Commands

```bash
npm install            # install all workspaces
docker compose up db   # local PostgreSQL (use existing compose file or create one)
npm run db:push        # push Drizzle schema to local DB (no migration files)
npm run db:generate    # generate migration files from schema changes
npm run db:migrate     # apply pending migrations
npm run dev            # runs web + api concurrently (turborepo or concurrently)
npm run lint
npm run typecheck
```

**Drizzle workflow**: edit schema in `packages/db/src/schema/` → `db:generate` → `db:migrate`. Never edit SQL migration files by hand.

## Database

- PostgreSQL. Drizzle ORM. Shared client exported from `packages/db`.
- `DATABASE_URL` env var points to `packages/db/.env`.

## Auth

NextAuth.js (Auth.js) handles sessions in `apps/web`. The Express API validates JWTs via middleware — any protected route in `apps/api` must use `authMiddleware`.

## Environment

Each app has its own `.env`:

| Var | Scope |
|---|---|
| `DATABASE_URL` | `packages/db`, `apps/api` |
| `NEXTAUTH_SECRET` | `apps/web` |
| `NEXTAUTH_URL` | `apps/web` |
| `STRIPE_PUBLISHABLE_KEY` | `apps/web` |
| `STRIPE_SECRET_KEY` | `apps/api` |
| `STRIPE_WEBHOOK_SECRET` | `apps/api` |
| `S3_BUCKET` | `apps/api` |
| `AWS_ACCESS_KEY_ID` | `apps/api` |
| `AWS_SECRET_ACCESS_KEY` | `apps/api` |
| `AWS_REGION` | `apps/api` |

## Deploy

Both apps run on a single EC2 t2.micro behind nginx:

- port 3000 → Next.js
- port 3001 → Express
- nginx reverse-proxies to each
- PM2 keeps both alive

## Security

- **CORS**: `cors()` must be configured to allow only the Next.js origin (production EC2 domain/IP, dev `http://localhost:3000`). Never use `*` or omit the option.
- **Rate limiting**: `express-rate-limit` on all routes. Stricter limits on `/api/auth/*` (login, register) and Stripe webhooks — separate limiter instances with different `windowMs`/`max`.
- **Stripe webhooks**: Always verify signatures via `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`. Never trust raw webhook payloads — the secret is the trust boundary.
- **Helmet**: `helmet()` middleware applied globally. Sets security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc.).
- **Input validation**: All request bodies and params validated with Zod schemas in `apps/api/src/validators/`. A `validate(schema)` middleware wraps every route — never trust raw `req.body`.
- **HTTPS**: SSL terminated at nginx. Express runs behind the proxy, so `app.set('trust proxy', 1)` is required for correct IP and secure-cookie handling.
- **SQL injection**: Drizzle's parameterized queries are safe by default. Never concatenate raw strings into SQL — use `sql` tagged template only when absolutely necessary and never with user input.
- **Row-Level Security (RLS)**: Optional future enhancement on PostgreSQL for sensitive tables (e.g. orders scoped to user). Not required initially — handled by service-layer checks for now.

## Conventions

- All API requests in the frontend go through a shared `apiClient` (or custom fetch wrapper) in `apps/web/lib/api.ts` — raw `fetch` to Express never inline.
- Image uploads happen through the API (multer → `@aws-sdk/client-s3`) — the frontend never talks to S3 directly. S3 uploads keep the same multer pattern the backend already uses.
- Every DB query lives in `apps/api/src/services/`, not in route handlers.
- Every new API route must have: rate-limit limiter, Zod validation middleware, and an `authMiddleware` guard if it's not a public endpoint.
