# Next steps (in suggested order)

> **Priority changed (2026-09-20): the POS is the active workstream.** Sections 1–5
> below are the (paused) e-commerce track. POS phases live in §6 and are updated as
> each phase ships.

## 1. Stripe end-to-end pass — DONE (2026-09-06)

Verified: test payment with `4242…` card → `checkout.session.completed` delivered
`[200]` to the API, order flipped `pending → paid`, payment intent stored, cart
cleared, stock decremented, no inventory flag. `STRIPE_WEBHOOK_SECRET` in
`apps/api/.env` confirmed correct against the `stripe listen` session.

- Idempotency proved end to end (2026-09-11): `stripe events resend evt_3UClKb…`
  → `[200]`, order stayed `paid` (no status flip), Test Product stock stayed **9**,
  `inventory_issue` unchanged, cart untouched — the real-world mirror of the
  duplicate-delivery test in `tests/checkout.test.ts`. Listener stopped afterwards.
- Note: `stripe listen` reused the same signing secret across sessions, so
  `STRIPE_WEBHOOK_SECRET` in `apps/api/.env` stays valid. If a future session prints a
  different `whsec_…`, update the env var and restart the API (nodemon won't reload it).

## 2. Admin panel UX (modals + product edit fixes)

Issues found while testing the Stripe flow. Shared piece first:

- DONE: **`apps/web/app/admin/modal.tsx`** — native `<dialog>` based `Modal` +
  `ConfirmDialog` (title, message, confirm/cancel, danger styling, loading state,
  inline error text). Errors render inside the modal instead of browser popups.

### Users — DONE

- DONE: role select opens the shared ConfirmDialog ("Change role of {name} from
  "x" to "y"?") → PATCH `{ role }` on confirm; Cancel reverts the dropdown
  (`roleChange ?? user.role`, fully controlled); picking the current role is a no-op.
- DONE: Deactivate/Activate opens a confirm modal (danger styling when deactivating,
  with a "no longer able to sign in" warning) → PATCH `{ isActive }`.
- Both paths render errors inline in the modal (backend self-guard 400 included).
- Modal click-through is manual.

## 2. Admin panel UX — COMPLETE

All four screens wired to the shared `<dialog>` modals: product delete, category
edit + delete, order status change, user role + active status.

### Products — DONE

- DONE: per-row **Edit** button (bordered) next to a red-bordered **Delete** button —
  Edit goes to the existing `/admin/products/[slug]` page (prefilled `ProductForm` +
  `PUT /api/admin/products/:id`).
- DONE (API fix): `productSchema.compareAtPrice` accepts `null`
  (`.nullable()` short-circuits before zod coercion — verified) — the form's empty
  compare-at field no longer 400s on save.
- DONE (API fix): `updateProduct` is now true full-replace — description,
  `compareAtPrice` and `categoryId` can be cleared (previously `?? existing`
  silently kept old values). Verified by curl: clear + restore round-trip.
- DONE: Delete uses the shared ConfirmDialog (danger) with the product name;
  failures render inside the modal.

### Categories — DONE

- DONE: per-row **Edit** button → shared `Modal` with prefilled name/slug/parent
  (parent select excludes the category itself, matching the service rule) →
  `PUT /api/admin/categories/:id`. Verified: rename round-trip 200, self-parent 400.
- DONE: Delete uses the shared ConfirmDialog (danger) with the category name; the
  backend's "Cannot delete category with subcategories or products…" renders inline
  in the modal.
- Known limitation (backend pre-existing): only self-parenting is blocked — deeper
  parent cycles are technically possible. Add an ancestor-chain check in
  `updateCategory` if it ever matters.

### Orders — DONE

- DONE: status select opens the shared ConfirmDialog ("Change status from X to Y?") →
  PATCH `{ status }` on confirm; Cancel/ESC reverts the dropdown (select value is
  `confirmStatus ?? status`, fully controlled). Errors render inline in the modal.
  Picking the current status is a no-op. "Mark resolved" stays one-click with `alert()`
  errors (by choice).

### Verify

- Slice 1 (products): typecheck; curl PUT clearing `compareAtPrice` + `categoryId` →
  200 + DB nulls (restored after); `/admin/products` renders with buttons + modal.
- Slice 2 (categories): curl rename round-trip 200/200, self-parent 400; page renders.
- Slice 3 (orders): typecheck; `/admin/orders` renders with dialog; modal
  click-through manual.
- `npm run typecheck`.

## 3. Automated tests — DONE (2026-09-09)

`vitest` in `apps/api`, 22 tests green (`npm run test`). They run against a dedicated
`sabate_test` database (same docker container; `npm run test:db-setup` creates it and
pushes the schema — dotenv never overrides pre-set env vars, so `tests/setup.ts`
repoints `DATABASE_URL` cleanly). Files run strictly sequentially
(`fileParallelism: false`) so truncations can't race.

- `tests/checkout.test.ts`: webhook idempotency (atomic claim, stock decremented
  exactly once), oversold flag (`inventory_issue=true`, stock untouched),
  `products_stock_non_negative` CHECK (23514), checkout 409 on over-stocked cart,
  cart-empty 400, Stripe-less 503 creates **no orphan orders**.
- `tests/auth.test.ts`: register/duplicate 409, login ok/401/disabled, password
  change round-trip.
- `tests/cart.test.ts`: add/list, stock-clamped add + update, product availability
  guards, remove 404 on repeat, clear.

Scope note: services-level only — no HTTP layer (no supertest); the zod validators
plus Express 5 error flow stay hand-verified. Tests are not in `tsc`'s `include`
(rootDir constraint) — vitest surfaces those errors at runtime.

## 4. Deployment checklist

The app has never run in production mode.

- Prod `.env` values on the EC2 (real `JWT_SECRET`, `CORS_ORIGIN`, Stripe live keys).
- PM2 startup + logs, nginx vhosts for ports 3000/3001, HTTPS cert.
- `npm run seed` on prod DB with `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` from env.
- Smoke: register, buy (live mode test card first), webhook received.

## 5. UX polish (optional)

- Cart item-count badge in the navbar.
- Order confirmation email (needs an email provider — real scope, plan first).
- Admin order detail page (skipped by choice — list page covers it for now).

## 6. POS local (inventario y ventas) — ACTIVE

Standalone system for the store, **two-PC model**: a headless Debian 12 server
(low RAM) runs the app; staff use Firefox from client machines at
`http://<server-ip>`. `apps/pos`, Spanish UI, own SQLite catalog/stock —
separate from the e-commerce DB. Roles: `owner` (todo) and `seller`
(POS + stock-bajo). Payment methods: efectivo, tarjeta, transferencia, cashea,
otro. Selling more than book stock blocks with "Stock insuficiente" (owner
adjusts via `Ajuste`). **Deploy after phase 4** (features churn until then;
redeploy = one script once systemd exists).

### Phase 1 — Scaffold + DB + auth — DONE (2026-09-20)

- Next.js 15 + Tailwind 4 (same versions as apps/web), API route handlers,
  better-sqlite3 v12 (Node 26 needs the v12 prebuilds; allowScripts approved) +
  Drizzle. DB at `data/pos.db`, WAL + foreign_keys ON.
- Schema: users, products (CHECK stock >= 0), sales, sale_items (name/price
  snapshot), stock_movements (audit for venta/recepcion/ajuste).
- Auth: login/logout route handlers, jose JWT in httpOnly cookie (30d),
  `middleware.ts` gate — `/login` + `/api/auth/*` public, everything else
  authenticated, `/inventario`, `/ventas`, `/usuarios` owner-only (stock-bajo
  allowed for sellers).
- Seed: owner from `SEED_OWNER_USERNAME`/`SEED_OWNER_PASSWORD` (fail-fast, min 8).
- Verified: login wrong/right, redirects with/without session, seller blocked
  from owner routes, logout clears session, typecheck OK.

### Phase 2 — Inventory + daily rate — DONE (2026-09-20)

- **Schema**: new `exchange_rates` (append-only, `bs_per_usd` integer céntimos de
  Bs per USD, who set it) + `sales.exchange_rate` snapshot column (added now so
  phase 3 needs no migration). SQLite can't ALTER ADD a NOT NULL column — the
  empty sales tables were dropped and recreated; drizzle-kit introspection wedged
  against the live dev server/WAL afterwards → **stop the dev server before
  `db:push -w apps/pos`** (documented in AGENTS.md).
- **Rate model** (client decision): prices are USD; Bs is derived from the day's
  rate; a rate is **valid 12 hours** from when it was set (`lib/rate.ts`) — the
  POS will refuse to sell on a stale/missing rate. `/tasa` (owner): current rate +
  validity badge + history; `POST /api/exchange-rate` appends.
- **Inventory** (`/inventario`, owner): table with $ and Bs columns (Bs at current
  rate), stock red when ≤ threshold; modals — Nuevo producto (initial stock writes
  a `recepcion` movement), Editar, **Stock** (Recepción = +N / Ajuste = set
  counted total, delta auto-computed), Desactivar/Activar confirm. Products are
  deactivated, never deleted. Shared `app/modal.tsx` (native `<dialog>`, ESC-safe).
- **Stock bajo** (`/inventario/stock-bajo`, sellers too): active products at/below
  threshold, read-only.
- **Gotcha found**: drizzle better-sqlite3 transactions are synchronous — async
  callbacks throw "cannot return a promise" AND can leave committed rows (a
  phantom product survived a rolled-back-looking 500). All handlers use
  `.all()`/`.get()`/`.run()` sync patterns now; documented in AGENTS.md.
- **Verified**: typecheck; curl — create (201 + movement), recepción +3, ajuste
  set-7 (delta -6 recorded), PATCH price/deactivate, seller 403 on all mutations,
  GET allowed; movements cascade; rate POST (9.100,50 → 910050); pages render
  (inventario empty state, tasa "Válida" badge, stock-bajo for seller); seller
  redirected from /inventario and /tasa.

### Phase 3 — POS sale screen — DONE (2026-09-21)

- **Screen** (`/`, owner and seller): search by name/SKU, product grid (click
  adds; disabled at "Sin stock"), ticket with qty −/+ y quitar, total in **$ y
  Bs**, método de pago (efectivo/tarjeta/transferencia/cashea/otro) y `Cobrar`.
  Success panel shows the receipt (browser print via `window.print()`, print CSS
  hides nav/buttons) + «Nueva venta»; `router.refresh()` reloads stock levels.
- **Sale API** `POST /api/sales` (any logged-in role): zod-validated; prices and
  the total are computed **inside** the DB transaction from catalog prices; the
  rate is re-checked server-side; conditional decrement
  (`WHERE stock >= qty`) + one `stock_movements` row per line (`venta`).
- **Rules enforced**: no sale without a valid (non-expired) rate → 409 (POS
  banner: owner gets «Actualizar tasa», seller sees «Avisa al propietario»); a
  line without stock refuses the whole ticket (409, no partial writes);
  inactive product → 409.
- **Tests**: `apps/pos/tests/sale.test.ts` (vitest, `data/pos-test.db`) covers
  total-from-DB-prices + rate snapshot + stock decrement + movements, refusal
  with rollback (nothing written), expired rate, no rate, and Bs conversion.
- **Verified**: 5 pos + 22 api tests, typecheck clean; curl — happy sale (total
  computed from DB, rate snapshot) with stock decremented + `venta` movements,
  oversell 409 with zero partial writes, seller sale 201, no-cookie 401, bad
  payload 400, inactive product 409; renders for both roles incl. stale-rate
  banner. **Manual check left**: Firefox print preview of the ticket.

Decisions (client): payment method only (no vuelto); no barcode/scanner (plain
search + click); minimal receipt (name, date, seller, lines, $ + Bs, rate,
method, short id — no RIF/correlativo); voiding a sale → phase 4.

### Phase 4 — Sales history/report + users — DONE (2026-09-21)

- **/ventas (owner)**: filter by date range (native `<input type="date">`, plain
  GET form → query params, «Hoy» resets), summary card (total del período in $
  and Bs, cantidad de ventas, anuladas), breakdown **by day** and **by payment
  method**, and the sales list (fecha, vendedor, método, $ + Bs, estado) capped
  at 500 rows for the period.
- **Numbers**: `lib/day.ts` cuts the day at **America/Caracas** (UTC−4, no DST)
  so dev and the store server agree; `lib/report.ts::summarize()` is a pure
  function that converts each sale at **its own snapshotted rate** (totals match
  the printed tickets) and **leaves voided sales out of every total**.
- **/ventas/[id]**: lines (producto, cantidad, precio, subtotal), tasa usada,
  the printable receipt (reuses `app/receipt.tsx`) and **«Anular venta»**
  (ConfirmDialog → repone stock + `anulacion` movement + marca la venta; la fila
  nunca se borra). Shows «Anulada el …» when already void.
- **/usuarios (owner)**: create sellers (usuario, nombre, contraseña ≥8),
  reset password, activate/deactivate. Users are **never deleted** (sales
  history); you can't deactivate yourself, and the last active owner is kept.
- **Guards**: `/ventas/*` added to the owner-only middleware rule (a seller could
  previously open a sale detail); void + users APIs check `owner` in the handler.
- **Schema**: `sales.voided_at` / `sales.voided_by`, plus `anulacion` in
  `stock_movements.reason`. Applied with a hand-written `ALTER TABLE` — see the
  drizzle-kit note in AGENTS.md (push can't evolve an existing SQLite DB here;
  fresh DBs, i.e. deployment, are fine).
- **Tests** (13 in apps/pos): void restocks + flags + `anulacion` movement +
  keeps the row, double void refuses, Caracas day boundary/range grouping,
  summarize totals (own rate per sale, voided excluded), Bs conversion.
- **Verified**: typecheck + `next build` clean (all routes dynamic); curl —
  create seller 201, duplicate 409, short password 400, seller 403; reset
  password then **login with the new one** (old one stops working); deactivate →
  login 401 → activate → login 200; self-deactivation 400; unknown user 404;
  sale → stock 7→5 → void → 7 with `anulacion` +2 and the sale flagged; void
  twice 409, unknown 404, seller 403, no cookie 401; /ventas totals
  ($ 6,50 / Bs 59.800,00, 2 ventas, 1 anulada) exclude the voided sale; empty
  range shows the empty state; detail renders; seller redirected from /ventas,
  /ventas/[id] and /usuarios. **Manual check left**: print preview of a
  reimpresión.

### Phase 4b — Categorías y marcas — DONE (2026-09-23)

SKU desaparece; en su lugar el producto tiene **categoría y marca, ambas
opcionales**, elegidas siempre de una lista (nunca escritas a mano):

- **Tablas** `categories` y `brands` (+ `products.category_id` / `brand_id`,
  nullable). `lib/tags.ts` concentra las reglas y un mapa `kind → (tabla, columna
  FK)` para no escribir el CRUD dos veces.
- **Guards**: nombre único ignorando mayúsculas y espacios (409 «Ya existe»);
  **no se puede eliminar un valor que usa un producto** (409 «En uso por N
  productos») — se renombra; un id que no existe o del tipo equivocado da
  404/400, no un 500 del FK.
- **`/inventario/clasificacion`** (owner, bajo `/inventario/` así que el
  middleware ya la protege): dos secciones con lista, agregar, renombrar y
  eliminar con confirmación. Link en el nav y en la cabecera de Inventario.
- **Producto**: los modales de alta/edición cambian el input SKU por dos
  `<select>` («Sin categoría» / «Sin marca»); el inventario muestra las dos
  columnas; el POS **busca por nombre, marca o categoría** y la tarjeta muestra
  la marca.
- **Migración**: tablas nuevas + `ALTER TABLE products ADD COLUMN …` a mano y
  `DROP COLUMN sku` (SQLite 3.53; `sale_items` sólo guardaba nombre y precio, no
  hay pérdida de historial). El test DB se recreó con `test:db-setup`.
- **Tests**: `tests/tags.test.ts` (5) — alta, duplicado case-insensitive,
  renombrar + choque, 404 al borrar lo que no existe, borrar en uso vs libre.
- **Verificado**: typecheck + `next build` limpios, 18 tests POS + 22 api; curl —
  201/409/404/400 en las rutas de tags, producto con y sin categoría+marca, id
  inválido 400, seller 403 en escritura y redirigido de la página; render de
  `/inventario` (columnas nuevas), `/inventario/clasificacion` y `/`.

### Phase 5 — Debian deployment (two-PC model) — PENDING, after phase 4

Server: headless Debian 12, **low RAM** → no git/build on the box; we ship a
pre-built bundle. Clients: Firefox at the server IP.

- `output: 'standalone'` in `apps/pos/next.config.ts`; build on the dev machine
  produces `.next/standalone/` (`server.js` + pruned node_modules incl. the
  compiled `better_sqlite3.node` — verify server arch is x64 at install time).
- `apps/pos/scripts/deploy.sh`: build here → rsync standalone + `.next/static` →
  `server:/opt/sabate-pos/app/` → `ssh systemctl restart sabate-pos`.
- systemd unit (file in repo + install steps): `PORT=80`, `HOSTNAME=0.0.0.0`,
  `AmbientCapabilities=CAP_NET_BIND_SERVICE` (bare-IP URL), `Restart=always`,
  dedicated `pos` user; `AUTH_SECRET`/`SQLITE_PATH` via unit env.
- DB lives outside the app dir (`/var/lib/sabate-pos/pos.db` via `SQLITE_PATH`)
  so deploys never clobber data; seed runs once over SSH (exact command in README).
- Server bootstrap (one-time, README): Node 22 via NodeSource (Debian 12's stock
  Node 18 is too old), firewall = app port to LAN subnet only + SSH, timezone
  `America/Caracas` (so daily sales match the store day), static IP / DHCP
  reservation.
- Backups: daily cron `sqlite3 pos.db ".backup …"` (WAL-safe; needs the `sqlite3`
  package on the server), 30-day retention, restore procedure documented.
- Accepted risk: plain HTTP on the store LAN (no TLS without a domain) — the
  session cookie is sniffable on-LAN. Fine for a small store; revisit only if
  it ever matters.
