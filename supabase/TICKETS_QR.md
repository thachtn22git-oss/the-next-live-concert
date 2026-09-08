# Phase 6: Digital tickets and QR verification

## Hosted setup

Apply [migrations/202609080004_digital_tickets.sql](migrations/202609080004_digital_tickets.sql) once, in full, in Supabase SQL Editor as the database owner. Phases 2-5 must already be applied, including `202609080003_orders.sql`. Do not rerun an already-applied migration. No new seeds, environment variables, Storage bucket or payment settings are required.

The migration includes its own transaction. Existing `confirmed` AND `paid` orders are backfilled. Pending/unpaid orders are not issued. If a historical eligible order has inconsistent item quantities or concert references, the migration fails and rolls back rather than issuing partial admissions. Inspect and correct historical data deliberately before retrying. Large backfills should be scheduled in a maintenance window.

No hosted migration or payment-status change is performed by the implementation or automated tests. Existing `.env.local` continues to use only the public Supabase URL/key. Never add service-role keys or secrets to Vite. Deployment must rewrite `/my-tickets/*` and `/verify-ticket/*` to `index.html`.

## Data model

`public.tickets` stores one admission per purchased unit, with:

- Independent random UUID ID, random readable `TNL-TKT-<32 hex characters>` code, and independent random UUID verification token. Ticket code and token are both unique; one cannot be derived from the other.
- References to the order, item, owner, concert and ticket type, with restrictive deletion rules.
- Ticket-name snapshot from the purchased order item and concert name/date/venue snapshots at issuance. These remain readable to the ticket owner even if the public concert is later unpublished. Unpublishing a concert or ticket type is not a revocation mechanism.
- A positive `admission_number`, unique together with `order_item_id`, to identify each unit in a multi-quantity item.
- `valid`, `used` or `cancelled` status; issued/created timestamps; `used_at` is required for `used` and absent otherwise.
- Owner/date and reference indexes for private reads and joins.

## Issuance lifecycle

`public.issue_tickets_for_order(p_order_id uuid)` is a trusted database/backend function, not a customer RPC. EXECUTE is revoked from PUBLIC, anon and authenticated. A frontend user with `profiles.role = 'admin'` still does not gain access to it.

The function locks the order with `FOR UPDATE`, requires exactly `confirmed` + `paid`, verifies its owner, holds item/concert locks, checks item totals and ticket/concert relationships, then generates one admission per purchased quantity. It derives all values from existing records. No customer-supplied ticket fields are accepted. Issuance does not increment `sold_quantity`; Phase 5 already reserved that stock.

The `sync_order_digital_tickets` AFTER UPDATE trigger on `orders.status` and `orders.payment_status` calls issuance whenever the new order is eligible. Setting paid and confirmed separately works: only the update completing both requirements issues tickets. Repeated eligible updates are safe. Normal orders are first created pending/unpaid through `create_order`, with items in the same transaction, then confirmed/paid by a future trusted payment backend. Do not directly insert confirmed/paid orders before their items exist; this is not a supported creation flow.

All attempts for one order serialize on its row lock. `UNIQUE(order_item_id, admission_number)` plus conflict handling prevents duplicate admissions. Repeating the function preserves the original IDs, codes, tokens, timestamps and statuses. A generation failure rolls back ticket inserts and the triggering order-status update together.

If an issued order loses confirmed/paid eligibility, the trigger cancels its still-valid tickets. Used tickets retain their audit status. Public verification additionally checks the current parent order, so an ineligible order never verifies as valid. Restoring confirmed/paid does not revive cancelled/used admissions or create replacements. Cancellation history is retained, not deleted. This is a fail-closed eligibility safeguard, not a refund/restock workflow.

Treat issued orders and item ownership, concert references, quantities and snapshots as immutable. Trusted maintenance must not reassign an issued order or mutate its items. The future payment backend should update payment/order statuses only. There is no customer capability to modify these records, restore tickets, mark payment paid, or mark an admission used.

## Access and QR security

RLS permits authenticated customers to SELECT only rows where `tickets.user_id = auth.uid()`. There are no public INSERT, UPDATE, DELETE or TRUNCATE grants. Anonymous users cannot list tickets. Own-ticket queries also filter by user in PostgREST; they never download everyone's tickets and filter in JavaScript. React route protection is not the authorization boundary.

`public.verify_ticket(p_token uuid)` is the only public verification API. It is a stable, read-only SECURITY DEFINER function with an empty search path and qualified table references. It returns at most one row, with this exact allowlist:

```text
is_valid
ticket_code
ticket_name
concert_name
concert_starts_at
venue
status
```

Unknown tokens return no rows. The frontend treats malformed tokens as not found without calling the database. A valid response requires a `valid` ticket and a currently confirmed/paid parent order. Neither opening the URL nor calling the RPC changes `status` or `used_at`.

The reusable `TicketQrCode` renders a local PNG with `qrcode`, black on white, a four-module quiet zone and medium error correction. QR data is only:

```text
https://YOUR-SITE/verify-ticket/<random-verification-token>
```

The browser's current origin is used, including `http://localhost:5173` in development. There is no external QR service or uploaded QR image. Email, phone, customer/user IDs, order ID, totals, credentials and other private data are not encoded or returned by verification. Client pages do not log tokens or save QR images in sessionStorage. The document's `no-referrer` policy avoids sending token-bearing page URLs as Referrer headers.

Tokens are bearer values: anyone who receives a QR image/link can read its safe event/admission details. Keep QR codes private. Configure production reverse proxies, analytics and error tracking to redact `/verify-ticket/*` tokens and RPC bodies; do not index verification URLs or add third-party tracking to them. Browser history and screenshots can still contain these values. Production API rate limiting and future token-replacement/revocation procedures are operational work. A public verification result is not proof that the person showing it owns the ticket, and is not staff check-in authorization.

## Frontend

- `/my-tickets`: protected, grouped by concert within each page, 24 admissions per page with a lookahead row and stable ordering. Loading/error/empty states, refresh, pagination and Vietnamese status labels reuse existing UI patterns.
- `/my-tickets/:ticketCode`: protected, independently fetches the current owner's ticket. Unknown and other-owner codes use the same not-found state. No internal IDs are displayed.
- `/verify-ticket/:token`: public safe status/event details, no customer information and no check-in controls.
- QR rendering is allowed only when both the admission and its parent order are eligible. Used/cancelled/ineligible admissions show an explicit unavailable state instead of a QR.
- Fetches have a 15-second timeout, cancellation, retry and focus refresh. Screens represent the last completed read; verification must be repeated for a fresh result. Future staff check-in needs an atomic server-side validation and consume operation, not reliance on an old screen or cached screenshot.
- Order success now says the order was created and explains that unpaid orders await confirmed payment before ticket issuance. It never asserts tickets were issued based only on navigation state.

Branding uses the existing official PNG asset and ticket-pass styles. Navigation, hero and unrelated page designs are unchanged. Digital-ticket routes are lazy-loaded so the QR library stays out of the initial public bundle.

## Exact manual development test

Use a development Supabase project, not production inventory. This simulates a trusted payment confirmation; it does not collect money.

1. Apply all migrations through `202609080004_digital_tickets.sql`. Log in as test account A.
2. Select STANDARD x2 and VIP x1 on `/tickets`, continue to checkout, enter contact data and confirm. Record the saved order code. Its statuses must initially be pending/unpaid.
3. Open `/my-tickets`: the new order must not produce any QR admissions yet.
4. In Supabase SQL Editor, replace `YOUR_ORDER_CODE` with that exact development order code and run:

```sql
begin;
update public.orders
set status = 'confirmed', payment_status = 'paid'
where order_code = 'YOUR_ORDER_CODE'
returning id, order_code, status, payment_status, total_quantity;

select t.ticket_code, t.ticket_name, t.admission_number, t.status
from public.tickets t
join public.orders o on o.id = t.order_id
where o.order_code = 'YOUR_ORDER_CODE'
order by t.ticket_name, t.admission_number;
commit;
```

5. Expect exactly three rows: two standard admissions and one VIP. No orders matching the code means the placeholder/code was wrong; do not broaden the UPDATE filter.
6. Check idempotency as the same trusted developer:

```sql
select public.issue_tickets_for_order(id)
from public.orders where order_code = 'YOUR_ORDER_CODE';

select count(*) as ticket_count
from public.tickets t join public.orders o on o.id = t.order_id
where o.order_code = 'YOUR_ORDER_CODE';
```

Expect three, not six, and unchanged codes/tokens.

7. Refresh `/my-tickets` as account A. Check the three separate passes, date, venue, statuses and QR images. Open each detail page and reload its URL to verify independent server fetching.
8. Scan a QR. It must open `/verify-ticket/<token>`, show safe event/ticket details and `Vé hợp lệ`, without email, phone, totals or account identifiers. Refresh/reopen and confirm the ticket is still valid with `used_at IS NULL` in the Table Editor.
9. On a separate phone, localhost points to the phone itself. For scanning tests use a deployed HTTPS development site, or a LAN-accessible development origin on both devices. QR codes are generated for the origin currently displaying them.
10. Sign in as account B and open A's private `/my-tickets/<ticketCode>` URL: not found. B's ticket list must exclude A's tickets. The public token URL intentionally remains callable without A's login, but exposes only the allowlist.
11. Open `/verify-ticket/not-a-token` and an unknown UUID: not found. To test revoked/used display, a trusted developer may change a single development ticket in Table Editor. A used test row needs both `status = 'used'` and a `used_at` timestamp. Never add such mutation to the customer frontend.
12. Optional eligibility-revocation test: change this development order's payment status away from paid. Its unused tickets must be cancelled and no longer verify as valid. Restoring paid must not revive those admissions. There is no automatic restock.

## Verification and files

```sh
npm test
npm run lint
npm run build
```

PGlite tests execute the real migration, including historical backfill, pending/unpaid exclusion, one-unit-per-record generation, mixed types, retry idempotency, ownership, denied direct writes, safe verification, non-mutating scans and eligibility revocation. PGlite is single-connection; true multi-session race checks should also be performed in a development PostgreSQL instance before production rollout.

Service and component tests cover private database filters, pagination, loading/empty/error states, individual ticket fetches, status/group formatting, eligibility-based QR visibility, public verification responses and QR generation. They use mocked HTTP or an isolated database, never hosted customer data.

Created:
- `supabase/migrations/202609080004_digital_tickets.sql`
- `supabase/TICKETS_QR.md`
- `src/features/tickets/services/digitalTicketService.js`
- `src/features/tickets/hooks/useDigitalTickets.js`
- `src/features/tickets/utils/digitalTickets.js`
- `src/features/tickets/components/TicketQrCode.jsx`
- `src/features/tickets/components/DigitalTicketPass.jsx`
- `src/pages/MyTicketDetailPage.jsx`
- `src/pages/VerifyTicketPage.jsx`
- `tests/digitalTicketDatabase.test.js`
- `tests/digitalTicketService.test.js`
- `tests/digitalTicketComponents.test.js`

Modified: `MyTicketsPage.jsx`, `OrderSuccessPage.jsx`, `src/router.jsx`, `index.html` (referrer privacy), `package.json` / `package-lock.json` (qrcode), and `supabase/README.md` / `ORDERS.md` (Phase 6 links).

Dependency audit at implementation time reports two moderate findings in the existing React Router dependency chain, with no compatible fix reported by npm. No forced major-version upgrade was made in this phase. The app is client-rendered (no SSR hydration) and the new route destinations use fixed prefixes plus generated/encoded values. Review router upgrades separately; passing build/tests does not eliminate dependency-advisory risk.

## Deferred

Real payments, webhooks, staff check-in, marking tickets used, admin CRUD, refund processing, email delivery, reservation expiration/restock and QR delivery outside the customer UI remain unimplemented. Phase 7 is not started. A future trusted payment backend can update confirmed/paid status and use this trigger without changing ticket-generation logic. Future check-in must add staff authorization and atomic one-time consumption; the current public verification function must remain read-only.

References: [Supabase function security](https://supabase.com/docs/guides/database/functions), [node-qrcode](https://github.com/soldair/node-qrcode).
