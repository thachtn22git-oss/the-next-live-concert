# Phase 7 — Admin dashboard and staff check-in

## Hosted Supabase setup

Apply `supabase/migrations/202609080005_admin_dashboard.sql` in the trusted Supabase SQL Editor, after `202609080004_digital_tickets.sql`. Historical migrations are unchanged. The migration has been tested locally with PGlite; it has **not** been applied to your hosted project by this implementation.

1. Register a test account at `/register`, complete email verification if enabled, then sign in once.
2. In the Supabase SQL Editor, replace the placeholder with that account's email and run:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where lower(email) = lower('YOUR_ADMIN_EMAIL')
)
returning id, role;
```

Expect exactly one returned profile. No returned row means the email/account/profile needs checking. Run this only in a trusted developer session; never put privileged credentials in the browser. To revoke access, use the same SQL with `role = 'user'`.

3. Sign out and sign in again (or reload to refetch the profile), then visit `/admin`.
4. `VITE_CONCERT_SLUG` selects the existing concert, with the same default as the public site. An unpublished concert is still editable by admins.

## Authorization and data safety

The existing route guard requires an authenticated account and a successfully loaded database profile with `role = 'admin'`. Metadata, frontend constants and local storage do not assign roles. All nested admin routes inherit this guard. A normal account sees a Vietnamese access-denied state.

The database independently enforces authorization. `is_admin()` is a stable SECURITY DEFINER helper with an empty search path and fully qualified tables; it reads the current `auth.uid()` profile without recursive profile RLS. Execution is restricted to authenticated accounts. Every admin RPC checks it before reading or changing data. Anonymous callers cannot execute those RPCs, and non-admin authenticated callers are rejected.

Admin RLS grants management access to artists, concert participation and schedules. Concert and ticket-type updates have explicit column grants; neither `sold_quantity` nor identifiers can be edited through ticket-type forms or browser updates. The existing inventory CHECK constraint prevents reducing total capacity below reserved/sold inventory, including a concurrent reservation. Concerts and ticket types have no browser DELETE grant. Orders, order items and tickets retain read-only table privileges; lifecycle writes happen only inside authorized RPCs. Profile role column grants remain unchanged, preventing self-promotion.

Removing a concert participant or artist with schedule entries is now blocked by a restrictive foreign key. Remove/reassign the associated schedule first. Artist and schedule deletion require UI confirmation. Historical orders, tickets and concert references retain their existing restrictive foreign keys.

## Admin pages

- `/admin`: private counts, confirmed/paid revenue, issued/used admissions and inventory.
- `/admin/concert`: existing event, publication and paginated concert lineup; participation order, billing and featured status.
- `/admin/artists`, `/admin/artists/new`, `/admin/artists/:id/edit`: artist CRUD, publication, image and social links. Social links use a JSON object such as `{"instagram":"https://instagram.com/example"}`.
- `/admin/schedule`: schedule CRUD. The artist picker only offers concert participants; the database enforces that relationship too.
- `/admin/ticket-types`: edit prices, inventory capacity, sale windows and activation. Reserved/sold inventory is read-only.
- `/admin/orders`, `/admin/orders/:orderCode`: paginated search/filtering, customer details, line-item snapshots, totals, issued count and trusted actions.
- `/admin/tickets`: paginated ticket-code search with status, issue/use dates and order link; raw verification tokens are not selected for this table.
- `/admin/check-in`: manual code/token/verification-URL entry. No camera dependency.

Dates in forms and displays use Vietnam time (UTC+7). Validation follows the project's existing plain JavaScript approach, with Vietnamese messages and no added validation library. Lists and artist pickers use 20-row pages and stable ordering; order filters run on the server and search executes on submission. Search punctuation that could alter PostgREST filter syntax is removed. Timestamp/status indexes support ordering/filtering. Substring search and exact counts may require trigram indexes or cursor pagination at much larger scale.

## Manual order confirmation

`admin_confirm_order(p_order_id uuid)` checks admin, locks the order, accepts pending/unpaid or pending/failed, and atomically sets confirmed/paid. The Phase 6 trigger issues one digital ticket per purchased unit in the same transaction. A failure in issuance rolls back payment confirmation. An already confirmed/paid order returns safely without issuing duplicates; cancelled/refunded or released orders cannot be reconfirmed.

The Vietnamese button asks for confirmation that payment was received manually/offline. This is a trusted development/offline recordkeeping action, not payment processing. Dashboard revenue counts only confirmed/paid orders; cancelled and unpaid orders are excluded.

## Cancellation and inventory

`admin_cancel_order(p_order_id uuid)` locks the order first. Orders with used tickets cannot be cancelled. Refunded orders are rejected because refund handling is deferred. Inventory rows are locked in UUID order, matching order creation. Reserved quantities are subtracted with an underflow check in the same transaction as cancellation and `inventory_released_at`. Repeating cancellation returns without releasing stock again. The Phase 6 lifecycle cancels unused digital tickets. Paid history is retained; no money is refunded.

Pending unpaid orders still reserve capacity. An admin must cancel them to release it; automatic expiration is deferred. Orders already cancelled before this migration are left untouched because their previous manual inventory handling cannot be inferred safely. Their release marker remains null; reconcile any such historical data separately in a trusted database session.

## Check-in and public verification

`admin_lookup_ticket(p_reference text)` is an admin-only read-only preview. It returns only ticket code/type, event snapshot/date/venue, effective status and use timestamp. The UI parses verification URLs locally without requesting that URL or logging its bearer token.

`check_in_ticket(p_reference text)` checks admin, resolves token/code, locks the order and then ticket row, verifies confirmed/paid and valid status, and atomically sets `status = 'used'` and `used_at = clock_timestamp()`. Both cancellation and check-in take the order lock first, preventing a cancellation/admission race. The second scanner waits for the first transaction and then fails with `TA007` / “Vé đã được sử dụng.” It never overwrites the timestamp. Cancelled tickets are rejected. The UI requires an explicit confirmation after preview, and the RPC revalidates the current state.

`/verify-ticket/:token` and the existing public `verify_ticket` RPC remain read-only. Opening a QR link never admits a customer. Admin lookup/check-in do not return customer contact data.

## Manual acceptance tests

1. Complete the hosted setup above; sign in via `/login`, then open `/admin`. Check stats and inventory against your test orders.
2. At `/admin/artists/new`, create an artist with a unique slug. Edit biography and publish. At `/admin/concert`, add this artist to the lineup and set billing/order/featured status.
3. At `/admin/schedule`, add a slot for that artist with an end after its start. Edit stage/time, publish, and confirm the public schedule after reloading. Try deleting the participant while the slot exists: it must fail safely. Delete/reassign the slot before removing the participant.
4. Try saving ticket capacity below the displayed sold/reserved count: validation/database must reject it.
5. As a normal customer, create an unpaid order at checkout. As admin, search for its code at `/admin/orders`; check filters and details. Click **XÁC NHẬN ĐÃ THANH TOÁN**, accept the dialog, and verify confirmed/paid plus the expected issued ticket count. Reload and confirm no duplicate tickets. Customer `/my-tickets` must show the issued admissions.
6. Copy the customer's verification URL. Open it in a signed-out browser twice: it must still show valid and remain unused.
7. Paste it at `/admin/check-in`; click **Kiểm tra vé**. Verify **VÉ HỢP LỆ** with event info. Click **Xác nhận check-in** and expect **CHECK-IN THÀNH CÔNG** with a timestamp.
8. Paste/submit the same URL again: expect **VÉ ĐÃ ĐƯỢC SỬ DỤNG**, without another confirmation button. For a concurrency check, preview the same unused ticket in two admin windows; confirm both. Exactly one succeeds; the other shows “Vé đã được sử dụng.” The timestamp stays unchanged.
9. Cancel a separate pending order. Verify inventory rises by its quantity exactly once; repeat the RPC as admin to confirm idempotency. Confirm a separate order, cancel it before check-in, and verify its digital tickets show cancelled and cannot be admitted. Cancelling a used order must fail.
10. Sign out and sign in as a normal user. Visit `/admin` and nested pages: access must be denied. Manually invoking admin RPCs through that user's Supabase session must fail; direct role, payment, ticket-status and sold-quantity writes must fail too. Anonymous public verification must continue to work read-only.

## Verification and limitations

Automated tests use real migrations in PGlite to test role grants/RLS, allowed event edits, profile privilege protection, confirmation and issuance rollback, cancellation/release idempotency, used-ticket rejection and read-only verification. React tests cover role guards/profile resolution, new form validation and preview/check-in/error behavior. Service tests cover pagination, search/filter construction and token omission. PGlite does not substitute for a multi-connection hosted concurrency test; run step 8 against hosted Supabase.

Run `npm test`, `npm run lint`, `npm run build` (on Windows with restrictive PowerShell script policy, use `npm.cmd`). No service-role secret, customer lifecycle update, mutable public verification, or public aggregate RPC was introduced.

Deferred: real payment gateway, payment webhooks, automatic pending-order expiration, refunds, email delivery, camera QR scanning, and a dedicated staff role/audit log. Admin acts as staff. No Phase 8 work is included.
