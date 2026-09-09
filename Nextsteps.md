# Next steps (in suggested order)

## 1. Stripe end-to-end pass — DONE (2026-09-06)

Verified: test payment with `4242…` card → `checkout.session.completed` delivered
`[200]` to the API, order flipped `pending → paid`, payment intent stored, cart
cleared, stock decremented, no inventory flag. `STRIPE_WEBHOOK_SECRET` in
`apps/api/.env` confirmed correct against the `stripe listen` session.

- Remaining nicety: resend the real event once (`stripe events resend evt_…`, ids in
  the listener log) to prove no double stock decrement, then stop `stripe listen`.

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
