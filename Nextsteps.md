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

Standalone system for the store's Debian PC (`apps/pos`, browser on localhost,
Spanish UI, own SQLite catalog/stock — separate from the e-commerce DB).
Roles: `owner` (todo) and `seller` (POS + stock-bajo). Payment methods:
efectivo, tarjeta, transferencia, cashea, otro. Selling more than book stock
blocks with "Stock insuficiente" (owner adjusts via `Ajuste`).

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

### Phase 2 — Inventory — PENDING

Product CRUD (owner, deactivate instead of delete), list with stock +
low-stock flags, receive/adjust stock (writes stock_movements), stock-bajo view.

### Phase 3 — POS sale screen — PENDING

Product search, ticket with quantities, payment method, `Cobrar` in a
transaction (conditional decrement WHERE stock >= qty + movement row),
success panel + browser-print receipt. Small vitest file for the sale
transaction (money path).

### Phase 4 — Sales history/report + users — PENDING

/ventas (owner): list + totals by day and payment method, date filter.
/usuarios: owner creates/deactivates sellers, resets passwords.

### Phase 5 — Debian deployment — PENDING

`npm run build && npm start` on the store PC, systemd unit, backup script
(copy pos.db), POS README.
