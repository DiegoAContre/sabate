/# AGENTS.md

## Architecture

Monorepo with three workspace packages:

```
apps/web/            Next.js 15 (App Router) — frontend only, no API routes
apps/api/            Express 5 — all business logic lives here
apps/pos/            Next.js 15 — self-contained local POS (own SQLite DB)
packages/db/         Drizzle schema, migrations, shared DB client
```

**The web app routes all data through the Express API.** Never add API routes or server actions to `apps/web`. Frontend calls `apps/api` over HTTP.

**Exception: `apps/pos` is self-contained on purpose.** It runs on a headless Debian 12 server on the store LAN — staff open it in Firefox at the server's IP (port 80 in production). It keeps its **own catalog and stock** (SQLite; path from `SQLITE_PATH` — dev: `apps/pos/data/pos.db`, prod: `/var/lib/sabate-pos/pos.db`, fully separate from the e-commerce Postgres DB), and uses API route handlers inside the app — the "no API routes" rule only applies to `apps/web`. UI is Spanish; roles are `owner` (todo) and `seller` (POS screen + stock-bajo only). Production deploys ship a pre-built `output: 'standalone'` bundle (low-RAM server: no git/build on the box) — see `Nextsteps.md` §6.

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
│   ├── rateLimiter.ts    # generalLimiter + authLimiter + webhookLimiter
├── routes/
│   ├── auth.ts           # POST /api/auth/register, /api/auth/login, GET/PATCH /api/auth/me, POST /api/auth/change-password
│   ├── cart.ts           # GET/POST/PUT/DELETE /api/cart (protected)
│   ├── catalog.ts        # public + admin category/product routes
│   ├── checkout.ts       # POST /api/checkout (protected)
│   ├── health.ts         # GET /health (public, no auth)
│   ├── orders.ts         # GET /api/orders, /api/orders/:id (user-scoped); GET /api/admin/orders, PATCH /api/admin/orders/:id (admin)
│   ├── upload.ts         # POST /api/admin/upload (admin), POST /api/upload/avatar (user) — multer → S3
│   ├── users.ts          # GET /api/admin/users, PATCH /api/admin/users/:id (admin)
│   └── webhooks.ts       # POST /api/webhooks/stripe (raw body, signature-verified)
├── services/
│   ├── authService.ts    # register, login, JWT generation, profile update, password change
│   ├── cartService.ts    # cart CRUD (user-scoped, stock-capped)
│   ├── catalogService.ts # category/product CRUD + listing
│   ├── checkoutService.ts # Stripe Checkout Session creation + webhook handler
│   ├── orderService.ts   # order retrieval (user-scoped) + admin list + status update
│   ├── s3Service.ts      # S3 upload helper
│   └── userService.ts    # user list + role/isActive update (admin)
├── validators/
│   ├── auth.ts           # register/login/update-profile/change-password Zod schemas
│   ├── cart.ts           # add/update cart Zod schemas
│   ├── catalog.ts        # category/product/listing Zod schemas
│   ├── checkout.ts       # shipping address Zod schema
│   ├── orders.ts         # order param + update Zod schemas
│   └── users.ts          # user param + update Zod schemas
└── utils/
    └── AppError.ts       # statusCode-aware error class
```

### apps/pos structure

Self-contained POS: Next.js API route handlers + better-sqlite3 via Drizzle. No Express, no packages/db. All in `apps/pos`:

```
db/schema.ts           # users, products, categories, brands, sales, sale_items, stock_movements, exchange_rates (SQLite)
db/client.ts           # better-sqlite3 + drizzle (WAL, foreign_keys ON) — re-exports schema
lib/token.ts           # edge-safe jose JWT sign/verify (used by middleware)
lib/auth.ts            # getSession() via next/headers (re-exports token helpers)
lib/rate.ts            # current rate + 12h validity
lib/format.ts          # USD cents → "$ 1.234,56"; Bs via rate → "Bs 91.005,00" (es-VE)
lib/payment.ts         # PAYMENT_METHODS — shared by schema, sale API and POS dropdown
lib/sale.ts            # createSale() + voidSale(): totals, stock, movements, rate snapshot
lib/day.ts             # Caracas day boundary (UTC−4, no DST) for reports and filters
lib/report.ts          # summarize(): period totals + by day + by method (pure)
lib/tags.ts            # categories/brands CRUD + guards (one code path, kind picks the table)
middleware.ts          # auth gate + owner-only routes (/inventario, /ventas, /usuarios, /tasa)
app/api/auth/          # login/logout route handlers (zod-validated)
app/api/products/      # product CRUD + receive/adjust stock movements (owner-guarded)
app/api/tags/[kind]/   # GET list + POST create a category/brand (owner writes)
app/api/tags/[kind]/[id]/  # PATCH rename, DELETE (owner; 409 if a product uses it)
app/api/sales/         # POST a sale (any logged-in role, owner or seller)
app/api/sales/[id]/void/  # POST anula una venta (owner): restock + compensating movement
app/api/users/         # POST create seller; PATCH [id]: password / isActive (owner)
app/api/exchange-rate/ # POST the day's Bs/$ rate (owner)
app/api/admin/backup/  # POST daily VACUUM INTO copy (owner session or BACKUP_TOKEN)
app/pos-screen.tsx     # client: search + product grid + ticket + Cobrar
app/receipt.tsx        # printable ticket ($ + Bs, tasa usada, método)
app/inventario/        # product table + modals: create/edit/stock/deactivate (owner)
app/inventario/clasificacion/  # categories + brands lists (owner): add, rename, delete
app/inventario/stock-bajo/  # low-stock view (sellers too, read-only)
app/ventas/            # sales list + day/method totals + date filter (owner)
app/ventas/[id]/       # sale detail: lines, receipt reprint, «Anular venta» (owner)
app/usuarios/          # users: create seller, reset password, activate/deactivate (owner)
app/tasa/              # daily rate: current + history + set new (owner)
app/login/             # Spanish login screen
scripts/seed.ts        # creates the owner user from SEED_OWNER_* env (fail-fast)
```

Conventions: money as integer cents; ids via crypto.randomUUID(); stock non-negative via SQLite CHECK; every sale/receive/adjustment writes a `stock_movements` audit row; products are deactivated, never hard-deleted (history preservation). **A product's category and brand are optional and always picked from `categories`/`brands`** — never typed free, so "adidas"/"Adidas" can't both exist; names are unique ignoring case/spaces, and a value a product uses can't be deleted (409) — rename it. **Prices are USD cents; Bs amounts are derived via the day's exchange rate** (`exchange_rates.bs_per_usd`, integer céntimos de Bs per USD, append-only history, valid 12h from set — `lib/rate.ts`); sales snapshot the rate at sale time. **A sale refuses to run without a valid rate** and is all-or-nothing: prices come from the DB (never the client) and a line without stock rolls the whole ticket back. **Voiding a sale flags it (`voided_at`/`voided_by`), never deletes it**: the stock is restocked and each line leaves an `anulacion` movement; reports count it as «anulada» and leave it out of the totals. Reports and filters use the **Caracas day** (`lib/day.ts`, UTC−4, no DST), not the machine's timezone; Bs totals convert each sale at **its own snapshotted rate**, so they match the printed tickets. Server pages read the DB directly; client mutations go through zod-validated API route handlers with owner checks in the handler (middleware guards pages by role). **Keep server-only imports out of client components** — `@/db/client` pulls node-sqlite3-wasm into the browser bundle; shared constants live in `lib/`.

**DB engine (node-sqlite3-wasm)**: the store server is 32-bit (Atom N270), so better-sqlite3 can't run there — `apps/pos/db/client.ts` adapts a pure-WASM driver to Drizzle's sync better-sqlite3 surface (single connection via `globalThis`, `prepare()/run()/get()/all()/raw()` + `transaction()`/SAVEPOINT). Gotchas: **no WAL** (journal `delete`); the VFS locks the DB via a `<db>.lock` directory, so no second process can open the file while the app runs; a stale lock after a crash blocks startup (next start / systemd removes it). `PRAGMA busy_timeout = 5000` keeps multiple in-process connections (dev's per-route bundles) from failing with SQLITE_BUSY. **Backups use a second in-process connection** (`app/api/admin/backup`, cron via `BACKUP_TOKEN`) because `VACUUM INTO` fails while any of the live connection's statements is open, and an external process can't open the file at all. `next.config.ts` ships `output: 'standalone'` + `serverExternalPackages: ['node-sqlite3-wasm']` + `outputFileTracingIncludes` for the `.wasm` binary (it's loaded from disk, tracing misses it otherwise); verified the bundle runs on Node 18.

Drizzle gotchas: **transactions are synchronous** — the callback must not be async; use `.all()`/`.get()`/`.run()` terminal methods (an async callback throws and can leave committed rows). **Stop the dev server before `npm run db:push -w apps/pos`** — drizzle-kit introspection wedges against a live DB. **drizzle-kit 0.31 cannot evolve an existing SQLite DB here**: it wedges on `index X already exists` and its recreate-and-copy SQL for new columns is broken (leaves a `__new_*` table behind). For additive changes, apply `ALTER TABLE … ADD COLUMN …` by hand (the drizzle runtime doesn't care) and drop any `__new_*` table left over; pushing to a **fresh** DB works fine, which is what deployment does.

### apps/web structure

```
auth.config.ts          # edge-safe Auth.js config (providers: [], authorized callback)
auth.ts                 # full Auth.js v5 config (credentials → Express login, JWT callbacks)
middleware.ts           # protects /cart, /account, /admin routes
lib/
├── api.ts              # shared apiClient (fetch → Express, Bearer token injection)
├── format.ts           # price formatting (cents → currency)
└── types.ts            # shared API response types (Product, Category, Paginated)
app/
├── layout.tsx          # root layout + SessionProvider
├── providers.tsx       # client-side SessionProvider wrapper
├── nav.tsx             # session-aware navbar
├── sign-out.tsx        # client sign-out button
├── page.tsx            # home: product grid + search/filter bar
├── search-bar.tsx      # client search + category filter
├── login/page.tsx      # NextAuth credentials login
├── register/page.tsx   # register → auto sign-in
├── account/
│   ├── page.tsx        # server: profile (fetch /api/auth/me)
│   ├── profile-form.tsx # client: name + avatar upload, change-password
│   └── orders/
│       ├── page.tsx    # server: list own orders
│       └── [id]/page.tsx # server: order detail + line items
├── admin/
│   ├── layout.tsx      # role guard (admin only)
│   ├── page.tsx        # admin dashboard links
│   ├── modal.tsx       # shared <dialog> Modal + ConfirmDialog (client)
│   ├── categories/
│   │   ├── page.tsx
│   │   ├── create-form.tsx
│   │   ├── edit-button.tsx # client: edit modal (name/slug/parent)
│   │   └── delete-button.tsx
│   ├── products/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   ├── [slug]/page.tsx
│   │   ├── product-form.tsx
│   │   └── delete-button.tsx
│   ├── users/
│   │   ├── page.tsx      # server: user list
│   │   └── user-actions.tsx # client: role select + activate/deactivate
│   └── orders/
│       ├── page.tsx    # server: list all orders
│       └── order-status-select.tsx # client: status dropdown
├── products/[slug]/
│   ├── page.tsx        # product detail
│   └── add-to-cart-button.tsx
├── cart/
│   ├── page.tsx        # server: cart list + total
│   └── cart-line.tsx   # client: qty +/- + remove
├── checkout/
│   ├── page.tsx        # server: order summary + shipping form
│   ├── checkout-form.tsx # client: POST /api/checkout → redirect to Stripe
│   ├── success/page.tsx
│   └── cancel/page.tsx
└── api/auth/[...nextauth]/route.ts
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

## Roadmap

The POS (`apps/pos`) is the active workstream — phases and status live in `Nextsteps.md` §6 (deploy to the store's Debian server after phase 4: standalone build + rsync + systemd, port 80). The e-commerce track is paused (§4 deployment checklist and §5 polish in `Nextsteps.md`).

Add ESLint and CloudFront/load-balancer scaling only when the business justifies the complexity.

## Commands

```bash
npm install               # install all workspaces
docker compose up db -d   # local PostgreSQL
npm run db:push           # push Drizzle schema to local DB (no migration files)
npm run db:generate       # generate migration files from schema changes
npm run db:migrate        # apply pending migrations
npm run db:studio         # Drizzle Studio GUI
npm run seed              # seed admin user and sample categories
npm run dev               # runs api + web concurrently
npm run dev -w apps/api   # run just the API (port 3001)
npm run dev -w apps/web   # run just the web app (port 3000)
npm run dev -w apps/pos   # run the local POS (port 3002)
npm run db:push -w apps/pos  # push POS SQLite schema (drizzle-kit, apps/pos/data/pos.db)
npm run seed -w apps/pos   # create the POS owner from SEED_OWNER_* env
npm run typecheck         # tsc --noEmit across all workspaces
npm run test              # vitest in apps/api against the `sabate_test` DB
npm run test:db-setup     # one-time (idempotent): create `sabate_test` DB + drizzle push
npm run test:pos          # vitest in apps/pos (sale transaction) against pos-test.db
npm run test:db-setup -w apps/pos  # one-time: create/push apps/pos/data/pos-test.db

# Tests run against a dedicated `sabate_test` database in the same docker
# container — never the dev DB. Vitest files run sequentially (shared DB).
# The POS suite uses its own throwaway SQLite file (dev POS data untouched).

# Stripe local webhook forwarding (requires Stripe CLI):
stripe listen --forward-to localhost:3001/api/webhooks/stripe
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
- Product stock is non-negative: DB `CHECK (stock >= 0)` on `products`, and checkout webhooks decrement conditionally (`WHERE stock >= qty`) inside a transaction. Concurrent webhook deliveries are idempotent via an atomic `pending → paid` claim (`UPDATE ... WHERE status='pending'`). If stock runs out after payment, the order is flagged `inventory_issue=true` and shows a banner/badge in `/admin/orders` for manual resolution (no auto-refund).

## Auth

NextAuth.js (Auth.js v5) handles sessions in `apps/web` via a credentials provider that calls `POST /api/auth/login` and stores the returned JWT as `session.accessToken`. The Express API validates JWTs via middleware — any protected route in `apps/api` must use `authMiddleware`. Use the `AUTH_` env prefix (v5), not `NEXTAUTH_`.

## Environment

Each app has its own `.env`:

| Var | Scope |
|---|---|
| `PORT` | `apps/api` (default `3001`) |
| `JWT_SECRET` | `apps/api` (min 32 chars, zod-validated) |
| `CORS_ORIGIN` | `apps/api` (must be valid URL, dev `http://localhost:3000`) |
| `DATABASE_URL` | `packages/db`, `apps/api` |
| `AUTH_SECRET` | `apps/web` (Auth.js v5) |
| `AUTH_URL` | `apps/web` (dev `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | `apps/web` (Express base URL, dev `http://localhost:3001`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `apps/web` |
| `AUTH_SECRET` | `apps/pos` (JWT signing, min 32 chars) |
| `SQLITE_PATH` | `apps/pos` (default `./data/pos.db`) |
| `SEED_OWNER_USERNAME` | `apps/pos` (required for `npm run seed -w apps/pos`) |
| `SEED_OWNER_PASSWORD` | `apps/pos` (required for seed, min 8 chars) |
| `BACKUP_DIR` | `apps/pos` (backups go here, default `./data/backups`, 30-day retention) |
| `BACKUP_TOKEN` | `apps/pos` (optional — `x-backup-token` header for cron `POST /api/admin/backup`; owner session also allowed) |
| `STRIPE_SECRET_KEY` | `apps/api` (optional — 503 if missing) |
| `STRIPE_WEBHOOK_SECRET` | `apps/api` (optional — 503 if missing) |
| `SEED_ADMIN_EMAIL` | `apps/api` (required for `npm run seed`) |
| `SEED_ADMIN_PASSWORD` | `apps/api` (required for `npm run seed`, min 8 chars) |
| `S3_BUCKET` | `apps/api` |
| `AWS_ACCESS_KEY_ID` | `apps/api` |
| `AWS_SECRET_ACCESS_KEY` | `apps/api` |
| `AWS_REGION` | `apps/api` |

## TypeScript

- `tsconfig.base.json`: `module: Node16`, `moduleResolution: Node16` — requires `.js` extensions on all relative imports (`./app.js` resolves to `app.ts`). Don't use bare `./app` — it breaks with Node16 resolution.
- CJS output (no `"type": "module"` in package.json). tsx + node both handle it.
- `strict: true` in base config. All packages extend it.
- `packages/db` overrides `declaration`/`declarationMap` to `false` because Drizzle's inferred types (especially self-referencing relations) cannot be emitted as `.d.ts` cleanly. Consumers import types directly from the source `.ts` via `main`/`types`.
- `apps/web` does **not** extend `tsconfig.base.json`. It uses its own Next.js config (`moduleResolution: bundler`, `jsx: preserve`, Next plugin). The Node16 `.js`-extension rule only applies to `apps/api` and `packages/db`.

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
- **Input validation**: All request bodies and params validated with Zod schemas in `apps/api/src/validators/`. A `validate(schema, source)` middleware wraps every route. It replaces `req.body`; for `query`/`params` it stores parsed data in `req.validatedQuery` / `req.validatedParams` because Express 5 makes those properties read-only.
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
