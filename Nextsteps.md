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

### Users — `admin/users/user-actions.tsx` (pending)

- Role select currently PATCHes immediately → open a confirm modal
  ("Change role of {name} from X to Y?") then PATCH `{ role }`.
- Deactivate/Activate uses `confirm()` → danger confirm modal → PATCH `{ isActive }`.

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

### Categories (pending)

- `PUT /api/admin/categories/:id` already exists — add a per-row **Edit** button that
  opens a modal (name, slug, parent select) and PUTs on save.
- Delete uses `confirm()` → ConfirmDialog.

### Orders — `admin/orders/order-status-select.tsx` (pending)

- Status select PATCHes immediately → confirm modal ("Change status from X to Y?")
  then PATCH `{ status }`. Keep "Mark resolved" one-click (small, reversible).

### Verify

- DONE (slice 1): typecheck; curl PUT product clearing `compareAtPrice` + `categoryId`
  → 200 and DB nulls (restored after); `/admin/products` renders with both buttons +
  modal markup.
- Remaining (slice 2): PUT a category rename; admin pages render; modal click-through
  is manual.
- `npm run typecheck`.

## 3. Automated tests

No test framework exists; everything is verified by hand via curl.

- Add `vitest` to `apps/api`, running against the local docker DB.
- Port the inventory smoke checks into a real test file: atomic webhook claim,
  conditional stock decrement, oversold flag, CHECK constraint, checkout 409.
- Add basics for auth (register/login/change-password) and cart (stock-capped add/update).

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
