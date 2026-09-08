# Phase 4: Ticket selection

## Apply the database changes

1. In the Supabase SQL Editor, run [migrations/202609080002_ticket_types.sql](migrations/202609080002_ticket_types.sql) once, after the existing migrations.
2. For development, run [seed_tickets.sql](seed_tickets.sql). It looks up the existing concert by slug `the-next-live-concert-2026`; if absent, run the original `seed.sql` first.
3. Keep your existing public Supabase environment variables. No service-role key or new environment variable is needed.
4. Run `npm run dev` and open `/tickets`.

The migration creates `ticket_types`, price/quantity/time-window constraints, a unique concert+slug key, an ordered active-ticket index, and an updated-at trigger. Public anonymous and authenticated roles can only SELECT active ticket types whose concert is published. There are no public write grants or mutation policies.

The seed is idempotent and never overwrites later changes, prices or sold quantities:

| Type | Vietnamese label | Price (VND) | Quantity | Limit per type |
| --- | --- | ---: | ---: | ---: |
| STANDARD | Tiêu chuẩn | 499000 | 1000 | 6 |
| VIP | VIP | 899000 | 500 | 4 |
| PREMIUM | Cao cấp | 1499000 | 150 | 2 |

Sale dates are null in development so the controls can be exercised immediately. These are sample tickets, not an official sale announcement. The home preview now reads the same Supabase prices, including PREMIUM at 1,499,000 VND.

## Selection architecture

- `ticketService.js` reads the configured published concert and active tickets, ordered by display order and ID. It is independent of artist/profile query failures.
- `TicketSelectionProvider` is mounted inside the existing main layout, so selection survives route changes including login. It owns a reducer with ticket data, quantities, sale time and adjustment notices.
- The list and reusable summary derive from that single selection. Quantities are integers bounded by zero, remaining inventory and the per-type `max_per_order`.
- `sessionStorage` contains only a version and ticket-ID-to-quantity map, scoped by concert slug. It contains no prices, tokens, email addresses or other personal information. Closing the browser tab normally ends this temporary selection. Storage failures fall back to in-memory selection.
- Successful data refreshes remove unknown/deactivated/sold-out tickets and clamp reduced limits. Network failures preserve the saved quantities but disable the visible selection workflow until a successful retry.
- Data refreshes on mount, window focus, explicit refresh and before continuing. A local one-second tick closes selections when their sale ends. If quantities or selected prices change during the continue check, the user reviews the new totals before continuing.
- Sale timestamps are absolute instants (`timestamptz`). A ticket is selectable at `sale_start`, but no longer at `sale_end`. Display uses `Asia/Ho_Chi_Minh`; use explicit `+07:00` offsets when editing Vietnamese sale times in SQL. Each null bound is unbounded.
- The home preview reuses the existing concert-pass style and new ticket component. Branding, navigation, hero and other section styling are unchanged.

## Continue and authentication

With zero tickets the continue button is disabled. Signed-in users go to `/checkout`; guests go to `/login` with React Router return state `/checkout`. Existing login behavior returns them there after success. The same-tab selection remains in session storage after refresh or detours. If registration/email confirmation starts a separate browser tab, selection is not guaranteed to transfer between tabs; return to the original tab to resume.

`/checkout` is protected and remains an informational placeholder with a link back to selection. It does not create an order, collect payment or reserve tickets.

## Manual checks

1. Open `/tickets`. Confirm the concert name/date/venue and three seeded passes.
2. Verify zero quantities, disabled minus buttons and disabled continue.
3. Select one of each type: expect **3 vé** and **2.897.000đ**.
4. Increase each to its limit: 6 standard, 4 VIP, 2 premium. Further increases must be disabled.
5. Refresh the page. Counts should return after ticket data loads.
6. Signed out, continue to login. Log in and confirm arrival at the checkout placeholder. Return to tickets and verify quantities remain.
7. Signed in, continue directly to the checkout placeholder.
8. In the Supabase Table Editor or trusted SQL, set a type's sold quantity equal to its total. Refocus the browser or refresh the data: expect **Hết vé**, disabled selection and removal from the summary.
9. Set `sale_start` in the future: expect **Chưa mở bán**. Set `sale_end` in the past with a valid range: expect **Đã kết thúc bán vé**. Both must disable selection.
10. Deactivate a ticket, lower inventory/limits or change a price, then continue from the old selection. Confirm it is refreshed and any necessary review notice appears.
11. Disable network and refresh ticket data. Expect the Vietnamese error and retry action. Re-enable network and retry; valid saved selection should recover.
12. Test at mobile and desktop widths. Quantity buttons should remain usable without horizontal scrolling.

All trusted SQL test changes affect your database; use a development concert. Re-running the seed does not undo those test edits.

## Phase 5 boundary

Client-side remaining quantity is a display estimate, never an inventory guarantee. Phase 5 must authenticate and authorize order creation, reread prices/limits/sale windows, and validate/reserve stock atomically on the server. Do not add direct browser updates to `sold_quantity`.

Intentionally absent: orders/order_items tables, inventory decrement, checkout processing, payment gateways, real tickets, QR codes, order emails and admin CRUD.

## Verification and files

```sh
npm test
npm run lint
npm run build
```

Tests cover VND formatting, quantities, per-type limits, sold-out/time-window states, totals, corrupted/blocked storage, reducer reconciliation, Supabase GET query scope/order, PostgreSQL constraints/RLS, the real React controls, reload persistence and auth continuation.

Created:

```text
supabase/migrations/202609080002_ticket_types.sql
supabase/seed_tickets.sql
supabase/TICKETS.md
src/features/tickets/components/TicketDataState.jsx
src/features/tickets/components/TicketPass.jsx
src/features/tickets/components/TicketSelectionSummary.jsx
src/features/tickets/context/TicketSelectionContext.js
src/features/tickets/context/TicketSelectionProvider.jsx
src/features/tickets/context/selectionReducer.js
src/features/tickets/hooks/useTicketSelection.js
src/features/tickets/services/ticketService.js
src/features/tickets/utils/storage.js
src/features/tickets/utils/tickets.js
tests/tickets.test.js
tests/ticketService.test.js
tests/ticketDatabase.test.js
tests/ticketComponents.test.js
```

Modified:

```text
src/pages/TicketsPage.jsx
src/pages/CheckoutPage.jsx
src/layouts/MainLayout.jsx
src/router.jsx
src/features/concerts/components/HomeSections.jsx
src/features/concerts/data/home.js
supabase/README.md
```
