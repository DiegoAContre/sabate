# AGENTS.md

## Architecture

One application: **`apps/pos`**, a self-contained local POS. It keeps its own
catalog and stock (SQLite; path from `SQLITE_PATH` — dev `apps/pos/data/pos.db`,
prod `/var/lib/sabate-pos/pos.db`) and uses API route handlers inside the app.
UI is Spanish; roles are `owner` (todo) and `seller` (POS screen, stock-bajo and
full inventory read-only). It runs on a headless Debian 12 server on the store LAN
— staff open it in Firefox at the server's IP (port 80 in production).

Production deploys ship a pre-built `output: 'standalone'` bundle (low-RAM
server: no git/build on the box) — see §Deploy. **A deploy ships code, never
data**: `apps/pos/scripts/deploy.sh` leaves the store's SQLite alone unless you
pass `INIT_DB=1` (which reseeds and **wipes it**), and you should pass
`BACKUP_TOKEN=…` so it snapshots before touching anything — both rules come from
the 2026-09-26 incident (see §Deploy).

### apps/pos structure

```
db/schema.ts           # users, products (+code), product_sizes, categories, brands, sales, sale_items (+size), stock_movements (+size), exchange_rates (SQLite)
db/client.ts           # node-sqlite3-wasm + drizzle (no WAL, foreign_keys ON, startup additive migration + product_sizes backfill) — re-exports schema
lib/token.ts           # edge-safe jose JWT sign/verify (used by middleware)
lib/auth.ts            # getSession() via next/headers (re-exports token helpers)
lib/rate.ts            # current rate + 12h validity
lib/format.ts          # USD cents → "$ 1.234,56"; Bs via rate → "Bs 91.005,00" (es-VE)
lib/tax.ts             # taxBreakdown(): IVA 16% / base imponible split (base + iva === total, Bs)
lib/payment.ts         # PAYMENT_METHODS (incl. pago_movil) + labels + REFERENCE_METHODS
lib/product.ts         # create/update product + per-size stock (receive/adjust, recompute total, movements)
lib/sale.ts            # createSale() + voidSale(): totals, per-size stock, movements, rate snapshot, reference
lib/day.ts             # Caracas day boundary (UTC−4, no DST) for reports and filters
lib/report.ts          # summarize(): period totals + by day + by method (pure)
lib/tags.ts            # categories/brands CRUD + guards (one code path, kind picks the table)
middleware.ts          # auth gate; owner-only /ventas, /usuarios, /tasa (/inventario is seller read-only)
app/api/auth/          # login/logout route handlers (zod-validated)
app/api/products/      # product CRUD + receive/adjust stock movements (owner-guarded)
app/api/tags/[kind]/   # GET list + POST create a category/brand (owner writes)
app/api/tags/[kind]/[id]/  # PATCH rename, DELETE (owner; 409 if a product uses it)
app/api/sales/         # POST a sale (any logged-in role): items, paymentMethod, optional reference
app/api/sales/[id]/void/  # POST anula una venta (owner): restock + compensating movement
app/api/users/         # POST create seller; PATCH [id]: password / isActive (owner)
app/api/exchange-rate/ # POST the day's Bs/$ rate (owner)
app/api/admin/backup/  # POST daily VACUUM INTO copy (owner session or BACKUP_TOKEN)
app/pos-screen.tsx     # client: search (name/code) + grid + per-size picker + ticket + IVA breakdown + reference + Cobrar
app/receipt.tsx        # printable ticket ($ + Bs, base imponible/IVA, tasa usada, método, referencia, talla)
app/inventario/        # product table (code + per-size breakdown) + modals: create/edit/stock/deactivate (owner; seller read-only)
app/inventario/clasificacion/  # categories + brands lists (owner): add, rename, delete
app/inventario/stock-bajo/  # low-stock view (sellers too, read-only)
app/ventas/            # sales list + day/method totals + date filter (owner)
app/ventas/[id]/       # sale detail: lines, receipt reprint, «Anular venta» (owner)
app/usuarios/          # users: create seller, reset password, activate/deactivate (owner)
app/tasa/              # daily rate: current + history + set new (owner)
app/login/             # Spanish login screen
scripts/seed.ts        # creates the owner user from SEED_OWNER_* env (fail-fast)
scripts/test-db-setup.ts   # builds the throwaway test DB from the committed SQL
scripts/deploy.sh      # build standalone + tar/ssh + restart + smoke (never touches the DB)
scripts/setup-server.sh    # idempotent one-time server setup (root)
```

Conventions: money as integer cents; ids via crypto.randomUUID(); stock
non-negative via SQLite CHECK; every sale/receive/adjustment writes a
`stock_movements` audit row; products are deactivated, never hard-deleted (history
preservation). **A product's category and brand are optional and always picked
from `categories`/`brands`** — never typed free, so "adidas"/"Adidas" can't both
exist; names are unique ignoring case/spaces, and a value a product uses can't be
deleted (409) — rename it. **Products carry an optional `code`** (free text,
searched in the POS, not unique) and **per-size stock** in `product_sizes` (size
label is free text, normalized upper-case; a product without real sizes uses a
single «ÚNICA» row). **`products.stock` is a cache of
`SUM(product_sizes.quantity)`** — `lib/product.ts` recomputes it inside the same
transaction on every receive/adjust/sale/void, and `lib/sale.ts` decrements one
size atomically (`WHERE quantity >= qty`), so the total always matches the sizes.
**Prices are USD cents; Bs amounts are derived via the day's exchange rate**
(`exchange_rates.bs_per_usd`, integer céntimos de Bs per USD, append-only history,
valid 12h from set — `lib/rate.ts`); sales snapshot the rate at sale time.
**Payment methods** live in `lib/payment.ts` (`efectivo`, `tarjeta`,
`transferencia`, `pago_movil`, `cashea`, `otro`) with display labels and
`REFERENCE_METHODS`; `transferencia`/`pago_movil` optionally store a bank
`reference` on the sale (`sales.reference`, printed on the receipt and shown in
the sale detail). **IVA is derived, never stored**: `lib/tax.ts` splits the Bs
total into base imponible + 16% IVA (`base = round(total·100/116)`,
`iva = total − base`, so `base + iva === total`); both the pre-`Cobrar` ticket and
the receipt/reprint show it. **A sale refuses to run without a valid rate** and is
all-or-nothing: prices come from the DB (never the client) and a line without
stock rolls the whole ticket back. **Voiding a sale flags it
(`voided_at`/`voided_by`), never deletes it**: the stock is restocked and each line
leaves an `anulacion` movement; reports count it as «anulada» and leave it out of
the totals. **Sellers may open `/inventario` read-only** — the page hides the
create/edit/stock actions for them while every mutation API stays owner-guarded.
Reports and filters use the **Caracas day** (`lib/day.ts`, UTC−4, no DST), not the
machine's timezone; Bs totals convert each sale at **its own snapshotted rate**, so
they match the printed tickets. **Readability**: `app/globals.css` sets
`html { font-size: 125% }` so the whole rem-based UI scales ~25% without browser
zoom (breakpoints unaffected — they use the initial root size). Server pages read
the DB directly; client mutations go through zod-validated API route handlers with
owner checks in the handler (middleware guards pages by role). **Keep server-only
imports out of client components** — `@/db/client` pulls node-sqlite3-wasm into
the browser bundle; shared constants live in `lib/`.

**DB engine (node-sqlite3-wasm)**: the store server is 32-bit (Atom N270), so
better-sqlite3 can't run there — `apps/pos/db/client.ts` adapts a pure-WASM driver
to Drizzle's sync better-sqlite3 surface (single connection via `globalThis`,
`prepare()/run()/get()/all()/raw()` + `transaction()`/SAVEPOINT). Gotchas: **no
WAL** (journal `delete`); the VFS locks the DB via a `<db>.lock` directory, so no
second process can open the file while the app runs; a stale lock after a crash
blocks startup (next start / systemd removes it). `PRAGMA busy_timeout = 5000`
keeps multiple in-process connections (dev's per-route bundles) from failing with
SQLITE_BUSY. **Backups use a second in-process connection**
(`app/api/admin/backup`, cron via `BACKUP_TOKEN`) because `VACUUM INTO` fails
while any of the live connection's statements is open, and an external process
can't open the file at all. `next.config.ts` ships `output: 'standalone'` +
`serverExternalPackages: ['node-sqlite3-wasm']` + `outputFileTracingIncludes` for
the `.wasm` binary (it's loaded from disk, tracing misses it otherwise); verified
the bundle runs on Node 18.

Drizzle gotchas: **transactions are synchronous** — the callback must not be
async; use `.all()`/`.get()`/`.run()` terminal methods (an async callback throws
and can leave committed rows). **Stop the dev server before
`npm run db:push -w apps/pos`** — drizzle-kit introspection wedges against a live
DB. **drizzle-kit 0.31 cannot evolve an existing SQLite DB here**: it wedges on
`index X already exists` and its recreate-and-copy SQL for new columns is broken
(leaves a `__new_*` table behind). For additive changes, apply
`ALTER TABLE … ADD COLUMN …` by hand (the drizzle runtime doesn't care) and drop
any `__new_*` table left over; pushing to a **fresh** DB works fine, which is what
deployment does. **The additive changes that had to reach the live store DB** are
handled by an app-level, idempotent set of `ALTER TABLE … ADD COLUMN` /
`CREATE TABLE … IF NOT EXISTS` in `apps/pos/db/client.ts` at startup (skipped
during `next build`, where parallel route bundles race the VFS lock); that's how
`sales.reference`, `products.code`, the `size` columns and `product_sizes`
(backfilled with a «ÚNICA» row per legacy product) shipped without a migration
tool.

## Commands

```bash
npm install                 # install the workspace
npm run dev                 # POS dev server (port 3002)
npm run db:push             # push the Drizzle schema to the dev SQLite
npm run seed                # create the owner from SEED_OWNER_*
npm run typecheck           # tsc --noEmit (apps/pos)
npm run test                # vitest in apps/pos (own throwaway SQLite)
npm run test:db-setup       # one-time: build apps/pos/data/pos-test.db from the committed SQL

# Tests run against apps/pos/data/pos-test.db — the dev POS data is never touched.
# The test DB is built from `apps/pos/drizzle/*.sql`; the app's startup migration
# adds the columns/tables that came after that baseline.
```

- **Dev server**: `next dev` on 3002. **No linter yet** — typecheck only.
- **Drizzle workflow**: edit `apps/pos/db/schema.ts`. For additive changes on an
  existing DB, add the `ALTER/CREATE` to the startup migration in `db/client.ts`
  (see the gotchas above); `db:push` only works cleanly on a fresh DB.

## Database

SQLite. Schema conventions: UUID primary keys (`crypto.randomUUID()`); money as
integer cents; `products.stock` is a derived cache of the per-size sums; stock is
non-negative via `CHECK`; sales keep a name/price/size snapshot; every stock
change writes a `stock_movements` audit row; rows are deactivated/flagged, never
hard-deleted (sales history).

## Auth

JWT signed with `jose` (`AUTH_SECRET`, min 32 chars) and stored in an httpOnly
cookie (30 days). `middleware.ts` gates every page/API: `/login` and
`/api/auth/*` are public, `/api/admin/backup` is a token bypass, everything else
requires a session, and `/ventas`, `/usuarios`, `/tasa` are owner-only. Mutation
handlers re-check the role in the handler; page access is also role-guarded.

## Environment

All vars live in `apps/pos/.env` (see `.env.example`):

| Var | Scope |
|---|---|
| `AUTH_SECRET` | `apps/pos` (JWT signing, min 32 chars) |
| `SQLITE_PATH` | `apps/pos` (default `./data/pos.db`) |
| `SEED_OWNER_USERNAME` | `apps/pos` (required for `npm run seed`) |
| `SEED_OWNER_PASSWORD` | `apps/pos` (required for seed, min 8 chars) |
| `BACKUP_DIR` | `apps/pos` (backups go here, default `./data/backups`, 30-day retention) |
| `BACKUP_TOKEN` | `apps/pos` (optional — `x-backup-token` header for cron `POST /api/admin/backup`; owner session also allowed) |
| `PORT` | `apps/pos` in production (systemd sets `80`; dev uses 3002) |
| `HOSTNAME` | `apps/pos` in production (`0.0.0.0`) |

## TypeScript

`apps/pos` uses its own Next.js config (`moduleResolution: bundler`,
`jsx: preserve`, Next plugin, `strict: true`) and `@/*` path alias — it does not
extend any shared base config. Server-only modules must not be imported from
client components (see the node-sqlite3-wasm note above).

## Deploy

Server: headless Debian 12, **low RAM** (32-bit Atom N270, 988 MB + 1 GB swap),
Node 18 (`/usr/bin/node`), no git/build on the box.

- `scripts/setup-server.sh` (one-time, as root): installs nodejs/sudo/rsync/curl/ufw,
  creates the 1 GB swap + fstab entry, the `pos` system user,
  `/etc/sudoers.d/pos-deploy` (NOPASSWD only for the exact tar/install/systemctl
  commands `deploy.sh` needs), the systemd unit, the daily backup cron and ufw.
  Secrets (`AUTH_SECRET`, `BACKUP_TOKEN`) are generated with `openssl rand` into
  `/var/lib/sabate-pos/.env` (root-readable only) — **never in the repo**.
- `scripts/deploy.sh`: `npm run build` → copy `.next/static` into the standalone →
  tar of the **whole `.next/standalone/` root** (`apps/` + `node_modules/`
  together) → `sudo tar --no-same-owner -xzf - -C /opt/sabate-pos` → `sudo
  systemctl restart sabate-pos` → smoke. It **never touches the DB unless
  `INIT_DB=1`**; with `BACKUP_TOKEN=…` it snapshots via `POST /api/admin/backup`
  **before** uploading.
- Server layout: systemd `sabate-pos.service` `User=pos`,
  `WorkingDirectory=/opt/sabate-pos/apps/pos`, `PORT=80` + `HOSTNAME=0.0.0.0` +
  `AmbientCapabilities=CAP_NET_BIND_SERVICE`, `ExecStartPre` removes a stale
  `<db>.lock`. DB at `/var/lib/sabate-pos/pos.db`; backups in
  `/var/lib/sabate-pos/backups/pos-AAAA-MM-DD.db` (30-day retention). ufw:
  `deny incoming` + allow 22/80 from `192.168.100.0/24`.
- **Incident 2026-09-26 (own goal, now impossible)**: an older deploy decided
  whether the DB existed with `test -f /var/lib/sabate-pos/pos.db` over SSH as
  `mirlaac`, who cannot traverse that directory (700 `pos:pos`) — so it always
  said "no DB" and reseeded, wiping the live catalog. Rule: **never decide
  anything about `/var/lib/sabate-pos` from a `mirlaac` shell**; the deploy now
  defaults to "don't touch the DB" (`INIT_DB=1`). To copy the DB out, use
  `sudo install -m 644 /var/lib/sabate-pos/pos.db ~/…`.
- **Accepted risk**: plain HTTP on the store LAN (no TLS without a domain) — the
  session cookie is sniffable on-LAN. Fine for a small store.

## Git

**Never commit, amend, or push** — the owner reviews and handles git manually.
Leave every change uncommitted in the working tree and end the task with a short
report of what changed; if a commit is ever explicitly requested, confirm first.

