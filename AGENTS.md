# AGENTS.md

## Architecture

Monorepo with three workspace packages:

```
apps/web/            Next.js 14+ (App Router) — frontend only, no API routes
apps/api/            Express 5 — all business logic lives here
packages/db/         Drizzle schema, migrations, shared DB client
```

**The web app routes all data through the Express API.** Never add API routes or server actions to `apps/web`. Frontend calls `apps/api` over HTTP.

### apps/api structure

```
src/
├── index.ts              # entry: listen, graceful shutdown, signal handlers
├── app.ts                # express factory: middleware chain → routes → 404 → errorHandler
├── config/env.ts         # zod-validated env (fails fast on missing vars)
├── middleware/
│   ├── errorHandler.ts   # central error handler (ZodError, AppError, generic)
│   ├── validate.ts       # zod validation factory for body/query/params
│   ├── authMiddleware.ts # JWT verification + requireRole helper
│   └── rateLimiter.ts    # generalLimiter (100/15min) + authLimiter (5/15min)
├── routes/
│   └── health.ts         # GET /health (public, no auth)
└── utils/
    └── AppError.ts       # statusCode-aware error class
```

### packages/db structure

```
src/
├── schema/
│   └── index.ts        # all tables, relations, and inferred types
├── client.ts           # pg Pool + drizzle client exported as `db`
└── index.ts            # re-exports schema + client for `@sabate/db`
drizzle.config.ts       # drizzle-kit config
drizzle/                # generated migration SQL + snapshots (committed)
```

Future directories (create when needed): `validators/`, `services/`.

## Commands

```bash
npm install               # install all workspaces
docker compose up db      # local PostgreSQL
npm run db:push           # push Drizzle schema to local DB (no migration files)
npm run db:generate       # generate migration files from schema changes
npm run db:migrate        # apply pending migrations
npm run db:studio         # Drizzle Studio GUI
npm run dev               # runs api (concurrently — add web when it exists)
npm run dev -w apps/api   # run just the API
npm run typecheck         # tsc --noEmit across all workspaces
```

- **Dev server**: nodemon watches `src/**/*.ts`, executes via tsx. Type `rs` in the terminal to manually restart.
- **Drizzle workflow**: edit schema in `packages/db/src/schema/` → `db:generate` → `db:migrate`. Never edit SQL migration files by hand.
- **No linter yet** — typecheck only. Add ESLint when the codebase grows.

## Database

- PostgreSQL. Drizzle ORM. Shared client exported from `packages/db`.
- `DATABASE_URL` env var points to `packages/db/.env`.
- Schema conventions:
  - UUID primary keys (`defaultRandom()`).
  - Money stored as integer cents (`integer`), never floats.
  - Product images stored as `json` array of S3 URLs.
  - `cart_items` uses composite PK `(user_id, product_id)`.
  - `orders`/`order_items` keep a snapshot of product name and price at purchase time.
- Self-referencing relations (e.g. categories parent/subcategories) must use `relationName` in both `one()` and `many()` so Drizzle can disambiguate.

## Auth

NextAuth.js (Auth.js) handles sessions in `apps/web`. The Express API validates JWTs via middleware — any protected route in `apps/api` must use `authMiddleware`.

## Environment

Each app has its own `.env`:

| Var | Scope |
|---|---|
| `PORT` | `apps/api` (default `3001`) |
| `JWT_SECRET` | `apps/api` (min 32 chars, zod-validated) |
| `CORS_ORIGIN` | `apps/api` (must be valid URL, dev `http://localhost:3000`) |
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

## TypeScript

- `tsconfig.base.json`: `module: Node16`, `moduleResolution: Node16` — requires `.js` extensions on all relative imports (`./app.js` resolves to `app.ts`). Don't use bare `./app` — it breaks with Node16 resolution.
- CJS output (no `"type": "module"` in package.json). tsx + node both handle it.
- `strict: true` in base config. All packages extend it.
- `packages/db` overrides `declaration`/`declarationMap` to `false` because Drizzle's inferred types (especially self-referencing relations) cannot be emitted as `.d.ts` cleanly. Consumers import types directly from the source `.ts` via `main`/`types`.

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

- **Express 5**: async errors flow to the error handler natively — no `catchAsync` wrapper needed.
- **Request logging**: `morgan('dev')` is wired in `app.ts`. Shows method, path, status code (color-coded), and response time in the console.
- **Password hashing**: `bcryptjs` (pure JS) — no native build dependencies, works on t2.micro without node-gyp.
- **Error responses**: use `AppError(message, statusCode)` from `src/utils/AppError.ts` for all operational errors. Generic errors fall through to the 500 handler.
- All API requests in the frontend go through a shared `apiClient` (or custom fetch wrapper) in `apps/web/lib/api.ts` — raw `fetch` to Express never inline.
- Image uploads happen through the API (multer → `@aws-sdk/client-s3`) — the frontend never talks to S3 directly. S3 uploads keep the same multer pattern the backend already uses.
- Every DB query lives in `apps/api/src/services/`, not in route handlers.
- Every new API route must have: rate-limit limiter, Zod validation middleware, and an `authMiddleware` guard if it's not a public endpoint.
