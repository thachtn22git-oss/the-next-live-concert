# Phase 5: Checkout and orders

Phase 6 adds digital tickets for confirmed/paid orders; see [digital ticket setup](TICKETS_QR.md). The boundaries below describe the original Phase 5 implementation.

Phase 5 creates real `pending` / `unpaid` orders. It does not charge money, issue individual tickets or generate QR codes. Existing branding, navigation, typography and public pages are preserved.

## Apply to hosted Supabase

1. Confirm the Phase 2, 3 and 4 migrations have already been applied, in filename order. See [public data setup](README.md), [authentication](AUTH.md) and [ticket setup](TICKETS.md).
2. In your project's SQL Editor, run the entire [202609080003_orders.sql](migrations/202609080003_orders.sql) file once as the project database owner. It includes `begin` / `commit`, tables, constraints, indexes, timestamp trigger, grants, RLS policies and the RPC. Do not run just the function without its grants/revokes. Do not rerun an already-applied migration.
3. No new seed or frontend environment variable is required. Keep the existing public Supabase URL/key and concert slug in `.env.local`; never add a service-role/secret key to Vite. Keep the existing email auth and redirect settings from Phase 3.
4. A development project needs the existing `seed.sql` and `seed_tickets.sql` content. Do not reset inventory on a live project to retest. There is no order seed because orders must be associated with actual authenticated users.
5. Run `npm run dev` and open `/tickets`. Until this migration is applied, checkout shows a safe Vietnamese error rather than creating an order.

The implementation and automated tests do not apply migrations or create orders in your hosted project. Deployment must rewrite frontend routes (including `/order-success/*`) to `index.html`.

## Tables and access

- `orders`: authenticated owner, concert, normalized customer contact details, unique nonsequential public code, status, payment status, total quantity, total VND amount, timestamps and a per-user unique request UUID.
- `order_items`: immutable name/price/subtotal snapshots, positive quantity and a reference to the ticket type. One row per ticket type per order. Subtotal must equal quantity times unit price.
- Both tables enable RLS. The authenticated role can SELECT only its own orders and their items. Anonymous clients cannot read either table. Neither browser role has direct INSERT, UPDATE, DELETE or TRUNCATE privileges. A public order code is not authorization.
- Account/concert/ticket deletion is restricted when referenced by an order. Deleting an order through trusted database administration cascades its items but does not restore inventory. Do not use deletion as a cancellation mechanism.
- `status` supports `pending`, `confirmed`, `cancelled`; `payment_status` supports `unpaid`, `paid`, `failed`, `refunded`. The public RPC always creates `pending` / `unpaid`; it cannot mark an order paid. UI labels are Vietnamese.

## Transactional RPC

Signature:

```sql
public.create_order(
  p_concert_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_items jsonb,
  p_request_id uuid
) returns jsonb
```

Items contain only `{ "ticket_type_id": "UUID", "quantity": 1 }`. The RPC returns `{ "order_id": "UUID", "order_code": "TNL-YYYYMMDD-..." }`.

The function is `SECURITY DEFINER` with an empty search path and qualified application objects. Only `authenticated` has EXECUTE. It obtains ownership from `auth.uid()`; there is no user ID input. Customer fields and item shape are validated again on the server. Duplicate ticket IDs, empty lists, invalid quantities and extra item fields are rejected. It accepts at most 50 types per request. Totals are calculated in the database with overflow bounds, including JavaScript's safe integer limit for amount display.

The concert must be published and is held with a shared row lock. Ticket rows are locked using `FOR UPDATE` in UUID order, independent of the input order. Under PostgreSQL's normal READ COMMITTED isolation, a competing checkout waits for the earlier transaction and then sees its updated stock. Each type must belong to the concert, be active, satisfy sale boundaries, and allow the requested quantity under both stock and `max_per_order`. Wall-clock time is checked after waits; all end dates are checked again after all locks are acquired. Timestamps are absolute instants; the order-code date is formatted in `Asia/Ho_Chi_Minh`.

Current database prices produce the snapshots and total. Order insertion, item insertion and `sold_quantity` increments all occur in the same transaction. Any error rolls everything back. There are no frontend inventory updates or separate order/item inserts. Frontend totals are estimates; the saved order summary reflects the authoritative prices at submission.

### Idempotency and interrupted requests

The browser generates a random request UUID and stores only this UUID, scoped by user, in `sessionStorage`. It retains the ID on failure and clears it only after a confirmed order response or successful recovery. No contact data or prices are stored there.

A transaction-scoped advisory lock serializes the same user's request ID. A replay returns the previously created order without reserving stock twice, even when the HTTP response was lost. The unique `(user_id, request_id)` constraint adds a database safeguard. A replay intentionally returns the original order even if the user has edited the form since that request; it never changes that order. Different request IDs are separate orders, not duplicates.

Checkout checks for a prior successful request on reload, including when the catalog has since invalidated the old selection. A manual recovery action is also available. The RPC request has a 30-second browser timeout and reads have 15-second timeouts. Aborting HTTP does not prove the database rolled back; retries therefore retain the same ID. Duplicate clicks are blocked immediately in memory as well as through the disabled button. When session storage is blocked, same-mount retries still work, but reload recovery is unavailable. Separate tabs with different request IDs can intentionally create separate orders.

## Frontend flow

`/tickets` -> login if needed -> protected `/checkout` -> protected `/order-success/:orderCode`.

Checkout prefills from the private profile and auth email, preserves edits when the profile loads later, validates required contact data and rechecks the selection before sending the RPC. It does not modify the profile. An empty selection offers a return to `/tickets`. Order failures retain the selection; existing Phase 4 catalog refresh/sale-window reconciliation still removes independently invalid quantities. Success clears the shared selection and its session storage entry.

The success page fetches by code and current user, including item snapshots. It does not read totals or payment status from navigation state. Unknown and unauthorized codes receive the same Vietnamese not-found state. Loading, safe errors and retry reuse the current components. `/my-tickets` remains the existing placeholder.

## Manual verification

Use a development Supabase project and two test accounts, never live inventory:

1. As a guest, select two standard tickets on `/tickets`. Continue, log in, and confirm the selection survives at `/checkout`. Opening `/checkout` directly while logged out must redirect to `/login`.
2. Verify contact prefilling. Empty name, invalid email or missing phone must prevent submission. Edit contact details and confirm the saved profile does not change.
3. With unchanged development prices, two standard tickets should display `998.000đ`. Click confirm twice rapidly. Expect one order, two total tickets, one order item and an increase of exactly two in `sold_quantity`.
4. Verify the success page says `Chờ xác nhận` and `Chưa thanh toán`. Reload its URL to verify it reads the database. Revisit `/tickets` to verify the selection was cleared.
5. In another account, open the first account's order URL. It must show not found. An unknown code must behave the same. Direct browser writes to either order table and to inventory must be denied.
6. Before submitting another selection, use trusted SQL in the development project to reduce remaining stock, deactivate a ticket, end its sale or change its price. The first three cases must reject the order with a Vietnamese message and no partial writes. A price change must use the current database price in saved snapshots, not the old frontend total. Restore test configuration deliberately after testing.
7. Simulate a dropped response using browser network controls. Reconnect and retry/reload. Recovery or the same request ID must return the original order without a second inventory increment.
8. Test real concurrency with two authenticated browser sessions selecting the last remaining ticket. Submit together: one order succeeds and the other gets an inventory error. Confirm only one new order and no overselling. For a deterministic lock-wait test, use two independent database sessions with test users: hold the first RPC in an uncommitted transaction, call the second RPC for the same last ticket, then commit the first; the waiting call must reject. Never spoof auth claims through the public frontend.

## Automated verification

```sh
npm test
npm run lint
npm run build
```

`orderDatabase.test.js` executes the actual SQL in PGlite. It covers validation, snapshots, DB prices, inventory increments, insufficient inventory, all-or-nothing rollback (including a forced failure after inserts), idempotency, own-user RLS and denied public writes. PGlite runs one database connection; this is not a true multi-session concurrency test. The lock design is exercised sequentially and the hosted two-session check above remains necessary.

Service tests use the real Supabase client with mocked HTTP, verifying RPC whitelisting, own-user query filters, snapshot reads, errors and persistence. Component tests cover validation, totals, empty checkout, duplicate clicks, failure preservation, success-only cleanup, reload recovery and success-page loading/error/not-found states. They do not create hosted orders or charge money.

## Phase 5 files

Created:
- `supabase/migrations/202609080003_orders.sql`: schema, transactional RPC and access control.
- `supabase/ORDERS.md`: setup, security, limitations and tests.
- `src/features/orders/services/orderService.js`: RPC and own-order reads.
- `src/features/orders/hooks/useOrderCreation.js`: submission, timeouts, duplicate prevention and recovery.
- `src/features/orders/hooks/useOrder.js`: cancellable order fetching and retry.
- `src/features/orders/utils/orders.js`: contact validation, safe error/status labels and snapshot summary adapter.
- `src/features/orders/utils/requestStorage.js`: per-user request ID persistence.
- `src/pages/OrderSuccessPage.jsx`: server-backed protected order result.
- `tests/orderDatabase.test.js`, `tests/orderService.test.js`, `tests/orderComponents.test.js`: database, service and UI coverage.

Modified:
- `src/pages/CheckoutPage.jsx`: checkout form and secure order submission.
- `src/router.jsx`: protected, lazy-loaded checkout and success routes.
- `src/features/tickets/context/TicketSelectionProvider.jsx`, `selectionReducer.js`: explicit success cleanup.
- `src/features/tickets/utils/tickets.js`: updated server-authority comment.
- `supabase/README.md`: Phase 5 setup link.

## Intentional boundaries and deployment risks

Pending unpaid orders consume stock in Phase 5, as requested. There is no automatic expiry, cancellation/restock workflow or limit on the number of separate orders per user. `max_per_order` is not a per-user purchase limit. Do not open unrestricted production sales until reservation expiry, abuse controls and operational reconciliation are designed. Trusted administrators must not alter inventory or order status in ways that bypass future lifecycle invariants. Merely changing a status does not release stock.

No real payments, payment webhooks, QR codes, individual ticket records, scanning, confirmation emails, refunds or admin CRUD are implemented. These remain later-phase work, not implied by an order-success screen.

References: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [PostgreSQL row locking](https://www.postgresql.org/docs/17/explicit-locking.html).
