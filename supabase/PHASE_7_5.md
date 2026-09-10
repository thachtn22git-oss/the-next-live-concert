# Phase 7.5 — Order expiration, artist uploads and stability

## Hosted setup: run these separately

Nothing in this phase was applied to hosted Supabase automatically. After Phase 7 (`202609080005_admin_dashboard.sql`), run in order:

1. **Core SQL:** `supabase/migrations/202609090001_order_expiration.sql`.
2. **Storage SQL:** `supabase/migrations/202609090002_artist_image_storage.sql`. This creates/configures the public `artist-images` bucket, a 5 MiB limit, JPEG/PNG/WebP restrictions, and admin-only Storage policies. Run in the trusted Supabase SQL Editor or migration runner where the managed `storage` schema exists. No manual bucket creation is needed.
3. **Optional automatic scheduling:** In the Supabase Dashboard, open **Integrations → Cron** and enable `pg_cron` (or enable it under Database Extensions). Then run `supabase/setup_order_expiration_cron.sql` as the trusted `postgres` user in SQL Editor. It schedules `public.expire_pending_orders()` every minute. Re-running the named schedule updates it instead of adding duplicates. Inspect **Cron → Jobs → History** for success and returned errors.

Core expiration and Storage do not depend on pg_cron. Without the scheduler, use **/admin/orders → Xử lý đơn hết hạn** or trusted SQL `select public.expire_pending_orders();`. The button processes up to 100 orders; repeat when it reports 100. Without a scheduler or a manual invocation, overdue reservations remain pending and continue occupying stock. Configure scheduling before relying on unattended expiration.

Official references used: [Supabase Cron installation](https://supabase.com/docs/guides/cron/install), [scheduling and monitoring jobs](https://supabase.com/docs/guides/cron/quickstart), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [bucket restrictions](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Order expiration design

`orders.expires_at` is set by a BEFORE INSERT trigger to `created_at + interval '15 minutes'` for pending/unpaid orders. The existing secure `create_order` RPC continues unchanged and automatically invokes this trigger. The browser cannot supply or update the deadline and cannot write inventory. Prices, sale windows, request idempotency and inventory remain validated by the original database transaction.

The migration backfills existing pending/unpaid orders from their creation time. It does **not** cancel them during migration. Old pending orders may therefore be immediately eligible on the first worker run. Confirmed, paid, failed and already-cancelled historical rows are not backfilled. `expired_at` distinguishes automatic expiration from manual cancellation; `inventory_released_at` continues to record the one-time release.

`expire_pending_orders()` is a trusted scheduler/SQL-only function. It selects up to 100 overdue pending/unpaid orders, locks their rows with `FOR UPDATE SKIP LOCKED`, and locks all affected ticket types in UUID order before processing any release. This avoids cross-order inventory lock inversion. The batch is one transaction: any inventory mismatch or underflow rolls back all changes in that invocation. Monitor failed jobs and investigate inconsistent records rather than ignoring errors. At more than 100 expirations per minute, increase job capacity operationally after measuring database load.

Manual cancellation and expiration share the internal `cancel_order_and_release(uuid, boolean)` helper. This helper is not executable by browser roles. It locks/rechecks the order, rejects used admissions and inconsistent inventory, checks item totals, releases stock, marks cancellation and records timestamps atomically. The existing Phase 6 trigger cancels unused tickets. A repeat invocation does not release stock again. Historical cancellations without a release marker are left untouched because their inventory history is unknown.

The worker rejects paid or confirmed orders, even if a deadline is in the past. `admin_expire_pending_orders()` is an authenticated-admin wrapper with no order-ID or timestamp arguments. Normal users and anonymous callers cannot execute expiration or the shared cancellation helper. Existing profile-role protection and order/ticket RLS remain intact.

### Confirmation race

Confirmation, cancellation, expiration and check-in coordinate through order locks. If confirmation acquires the lock and commits first, the order is confirmed/paid, inventory remains reserved and expiration skips it. If expiration wins, the order becomes cancelled and later confirmation fails. A displayed deadline alone does not change the order: an admin may confirm a pending order before the worker commits cancellation, even shortly after its deadline. This is deliberate first-committed-transition behavior, matching the requested race semantics.

Customer order details and admin order details show the Vietnam-time deadline and an informational local countdown. At zero, they ask for a status refresh rather than claiming the browser cancelled the order. Cancelled/expired orders show a terminal message and no active countdown. Refresh reads authoritative database state; no frequent browser network polling was added.

## Artist image upload

Artist create/edit forms now offer file selection, local preview and **Tải ảnh lên**. Accepted MIME types: `image/jpeg`, `image/png`, `image/webp`; maximum 5 MiB, nonempty files only. Storage enforces bucket size/type restrictions too. The service generates `artists/<random-uuid>.<jpg|png|webp>` using the MIME-to-extension mapping, never the original filename or personal information. Upload uses `upsert: false` to avoid replacement collisions.

After upload succeeds, its public URL populates `artists.image_url` in the form. **Lưu thay đổi** persists it. Upload failure leaves the existing URL intact; saving is disabled while uploading. The current working image is never deleted before the replacement is uploaded and saved. Public pages retain `ArtistImage` fallback behavior and readable alt text.

The normal artist form has no editable image URL field. **Đường dẫn nghệ sĩ** is the slug for `/artists/<slug>`, not an image path. The upload service uses the Storage response path to obtain the public URL; temporary `blob:` previews cannot be saved. A successful artist save refreshes the shared public concert data before navigating back to the artist list, so subsequent in-app public navigation uses the saved image. Text-only edits preserve the existing image; a failed save keeps the uploaded URL available for retry and shows no save-success message.

Old images and uploaded-but-unsaved files are deliberately retained. Storage and artist-row updates are separate requests; retaining files avoids deleting shared or externally hosted images. There is no automatic orphan cleanup in this phase. A trusted admin can review/delete unused files in Storage after verifying references. Never delete external URLs. MIME/size validation is not a malware scanner or an image-reencoding pipeline; uploads are restricted to trusted admins.

Public URLs serve artist images without login. Object listing and INSERT/UPDATE/DELETE policies use the existing `public.is_admin()` database-profile check. Restrictive write policies also prevent unrelated permissive policies from allowing anonymous or normal-user writes to this bucket. No service-role key is used by the browser.

## UX, accessibility and consistency

- Admin forms/actions use synchronous ref locks as well as disabled controls, covering same-tick repeated submission. New artist/schedule forms reuse a generated primary key on retry so a lost response cannot create a second row. A lost response may still require refreshing the list to see the already-saved record.
- Image upload blocks saving until completion and provides Vietnamese failure/success feedback. Minimal reusable Feedback styles are shared by forms, expiration actions and management feedback.
- Artist picker labels are associated with the actual select; field errors are associated with inputs/selects/textareas, and invalid submit focuses the first field. Picker failures include retry, and loading disables unavailable options.
- Table containers are named keyboard-focusable scroll regions. Long identifiers, event venues and account text wrap without forcing the page wider. Tablet ticket grids use two columns, mobile uses one; form fields and narrow-screen filters remain usable.
- The mobile navigation Escape key closes the menu and returns focus to its button. Visible focus outlines are preserved. Links use a darker hover color for readable contrast, and key controls have a 44px minimum height.
- Digital tickets include textual event, type, code, status, venue, event time, issued time and (when used) admission time alongside the responsive QR. QR remains constrained to its card width.
- Admin amounts reuse the existing `formatVnd` utility. Event/order/ticket dates use shared formatters with `Asia/Ho_Chi_Minh`. Artist edit datetime values retain Vietnam-time conversion.
- Homepage event date/venue, countdown, venue section and event page use existing Supabase concert data. Static branding remains static; the obsolete hard-coded countdown date was removed.

Responsive source review covered navbar, hero, artist cards/detail, schedule, ticket selection, checkout, order details, ticket list/QR detail and admin forms/tables/check-in against the 390px/768px/desktop breakpoints. **Live visual verification was not available: the browser tool returned “No browser is available.”** Run the viewport acceptance checks below before production.

## Global and route error handling

A React Error Boundary wraps authentication and the router. The router also has an error element for route/render/lazy-loading errors. Both show branded Vietnamese recovery actions (**TẢI LẠI**, **VỀ TRANG CHỦ**) without stack traces. A wildcard route supplies the branded Vietnamese 404 page. Route definitions are in `src/routes.jsx`, instantiated by the existing `src/router.jsx`.

Unknown artist slugs, inaccessible/unknown customer order codes, missing ticket codes and invalid verification tokens keep intentional Vietnamese empty/error states. Existing data error components avoid raw database messages. Network failures are not mislabeled as not-found results.

## Exact manual acceptance tests

### Expiration and inventory

1. Register/sign in as a normal test customer and create a fresh order. Record its code and quantity. On the order page, verify a deadline approximately 15 minutes after creation and the informational countdown.
2. In trusted SQL Editor, inspect the order and inventory (replace the placeholder):

```sql
select o.order_code, o.status, o.payment_status, o.created_at, o.expires_at,
       o.expired_at, o.inventory_released_at, t.name, t.sold_quantity, i.quantity
from public.orders o
join public.order_items i on i.order_id = o.id
join public.ticket_types t on t.id = i.ticket_type_id
where o.order_code = 'YOUR_TEST_ORDER_CODE';
```

3. Wait until the deadline, or accelerate **only this disposable pending/unpaid test order** in trusted SQL:

```sql
update public.orders
set expires_at = clock_timestamp() - interval '1 second'
where order_code = 'YOUR_TEST_ORDER_CODE'
  and status = 'pending' and payment_status = 'unpaid';
select public.expire_pending_orders();
```

4. Repeat the inspection query: status must be cancelled, `expired_at` and `inventory_released_at` must be set, and sold_quantity must decrease by that order's quantity. Call expiration again: no additional decrease. Try admin paid confirmation for this order: it must fail. Refresh the customer page and verify the expired/cancelled message.
5. Confirm another test order as paid first, then invoke expiration after its deadline. It must stay confirmed/paid with inventory unchanged. For actual concurrency, use two SQL Editor sessions: in session A begin a transaction and call `admin_confirm_order` with an admin JWT claim, leaving it uncommitted; session B's worker skips its locked order. Commit A and rerun B: it remains paid. Reverse the winner using an uncommitted expiration transaction: confirmation waits, then fails after expiration commits. Use only disposable orders and commit/rollback each session promptly.
6. With scheduling enabled, leave a new pending test order unattended beyond 15 minutes plus one scheduler interval. Confirm cancellation and successful Cron history. Without scheduling, test **/admin/orders → Xử lý đơn hết hạn**.

### Storage

1. Sign in as the database-profile admin and open `/admin/artists/new` or an existing artist edit route.
2. Select a PNG/JPEG/WebP below 5 MiB, inspect the preview and click **Tải ảnh lên**. Verify **Lưu thay đổi** is disabled during upload. Save the artist and check its public image (artist must be published and in the concert lineup).
3. Try an SVG/PDF and an image larger than 5 MiB: expect Vietnamese validation and no upload. Simulate offline mode during upload: expect a Vietnamese retry message and the original public image to remain intact.
4. Upload a replacement and save; verify the new public URL and that the old image was not prematurely deleted. Cancel an edit after upload: the old saved artist URL stays unchanged; the unused upload remains for later review.
5. In a test-only script using the project's public Supabase client signed in as a **normal user**, call `storage.from('artist-images').upload('artists/<uuid>.png', validFile)`. The server must reject it. Repeat signed out. Do not test with a service-role key, which bypasses RLS. Local automated tests verify actual RLS using a Storage schema fixture; this hosted test validates the Storage API too.

### Responsive, keyboard and errors

1. At **390×844**, **768×1024**, and **1440×900**, inspect `/`, `/artists`, an artist detail, `/schedule`, `/tickets`, `/checkout`, an order page, `/my-tickets`, a ticket detail and all admin pages including check-in. Use long artist/event/customer text. The page must not scroll horizontally; only admin table regions may scroll. QR must remain fully visible.
2. Use Tab/Shift+Tab through navigation, forms, upload and check-in. Verify labels, focus rings, invalid-field focus, disabled controls, readable status text and table scrolling. Open the mobile menu and press Escape; focus returns to its button.
3. Visit `/this-page-does-not-exist`: expect the branded 404 and working home/event links. Visit unknown artist/order/ticket routes and `/verify-ticket/not-a-token`: expect safe Vietnamese states.
4. Automated tests deliberately throw a render error and verify the recovery fallback contains no private error details. Public verification must remain read-only before/after all changes.

## Validation and security audit

Run `npm test`, `npm run lint`, `npm run build` (`npm.cmd` on Windows where PowerShell blocks npm.ps1). Tests cover real expiration SQL, both serial race outcomes, paid/confirmed/used-ticket exclusions, atomic underflow rollback, one-time release, Storage RLS/type/size/path behavior, upload failure/replacement, double submits, 404 wiring, error fallback and existing invalid order/ticket flows. PGlite is not a substitute for hosted multi-connection concurrency or actual Storage uploads.

`.env.local` remains ignored. Customer orders/tickets retain read-only table grants; no customer role/payment/check-in/sold-quantity mutation was added. Public verification is unchanged and read-only. New browser uploads use the public client and admin Storage RLS. No scheduler credentials are exposed to the browser.

Known limitations: scheduler activation is manual; bounded worker batches need monitoring; failed data invariants block the current batch; frontend countdown requires a refresh for authoritative status; old/orphan images are retained; hosted multi-session, Storage API and visual viewport checks remain manual. No payment gateway/webhook/refunds/email/SMS, Phase 8 deployment or redesign was implemented.
