import test from 'node:test';
import assert from 'node:assert/strict';
import { formatVnd, remainingQuantity, selectionLimit, saleStatus, reconcileSelection, selectionSummary } from '../src/features/tickets/utils/tickets.js';
import { readSelection, writeSelection, selectionKey } from '../src/features/tickets/utils/storage.js';
import { initialSelection, selectionReducer } from '../src/features/tickets/context/selectionReducer.js';

const now = Date.parse('2026-09-08T10:00:00+07:00');
const ticket = { id: '50000000-0000-4000-8000-000000000001', price: 499000, total_quantity: 1000, sold_quantity: 0, max_per_order: 6, is_active: true, sale_start: null, sale_end: null };

test('Vietnamese prices and totals use integer VND', () => {
  assert.equal(formatVnd(499000), '499.000đ');
  assert.equal(formatVnd(899000), '899.000đ');
  assert.equal(formatVnd(1499000), '1.499.000đ');
  assert.equal(formatVnd(0), '0đ');
  const vip = { ...ticket, id: 'vip', price: 899000 };
  const premium = { ...ticket, id: 'premium', price: 1499000 };
  const summary = selectionSummary({ [ticket.id]: 1, vip: 1, premium: 1 }, [ticket, vip, premium], now);
  assert.equal(summary.totalQuantity, 3);
  assert.equal(summary.totalAmount, 2897000);
  assert.equal(summary.items[1].subtotal, 899000);
  assert.equal(selectionSummary({}, [ticket], now).totalAmount, 0);
});

test('remaining quantity and per-order limits both constrain selection', () => {
  assert.equal(remainingQuantity(ticket), 1000);
  assert.equal(selectionLimit(ticket, now), 6);
  assert.equal(selectionLimit({ ...ticket, sold_quantity: 998 }, now), 2);
  assert.equal(remainingQuantity({ ...ticket, sold_quantity: 1001 }), 0);
  assert.equal(saleStatus({ ...ticket, sold_quantity: 1000 }, now), 'sold_out');
  assert.equal(selectionLimit({ ...ticket, sold_quantity: 1000 }, now), 0);
});

test('sale windows compare absolute instants and end exclusively', () => {
  const timed = { ...ticket, sale_start: '2026-09-08T10:00:00+07:00', sale_end: '2026-09-08T11:00:00+07:00' };
  assert.equal(saleStatus(timed, now - 1), 'upcoming');
  assert.equal(selectionLimit(timed, now - 1), 0);
  assert.equal(saleStatus(timed, Date.parse('2026-09-08T03:00:00Z')), 'available');
  assert.equal(saleStatus(timed, Date.parse(timed.sale_end)), 'ended');
  assert.equal(selectionLimit(timed, Date.parse(timed.sale_end)), 0);
  assert.equal(saleStatus({ ...ticket, is_active: false }, now), 'inactive');
  assert.equal(saleStatus({ ...ticket, sale_start: 'invalid' }, now), 'inactive');
  assert.equal(saleStatus({ ...ticket, sale_end: '2026-09-01T00:00:00+07:00' }, now), 'ended');
  assert.equal(saleStatus({ ...ticket, sale_start: '2026-10-01T00:00:00+07:00' }, now), 'upcoming');
});

test('reconciliation drops unknown/invalid tickets and clamps reduced inventory', () => {
  for (const count of [-1, 1.5, '2', Infinity, NaN]) assert.deepEqual(reconcileSelection({ [ticket.id]: count }, [ticket], now), {});
  assert.deepEqual(reconcileSelection({ [ticket.id]: 8, deleted: 3 }, [ticket], now), { [ticket.id]: 6 });
  assert.deepEqual(reconcileSelection({ [ticket.id]: 3 }, [{ ...ticket, sold_quantity: 999 }], now), { [ticket.id]: 1 });
  assert.deepEqual(reconcileSelection({ [ticket.id]: 2 }, [{ ...ticket, is_active: false }], now), {});
});

test('session persistence handles reload, concert isolation, corruption and blocked storage', () => {
  const saved = new Map();
  const storage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  writeSelection('concert', { [ticket.id]: 3 }, storage);
  assert.deepEqual(readSelection('concert', storage), { [ticket.id]: 3 });
  assert.deepEqual(readSelection('other-concert', storage), {});
  const payload = JSON.parse(saved.get(selectionKey('concert')));
  assert.deepEqual(Object.keys(payload).sort(), ['quantities', 'version']);
  saved.set(selectionKey('concert'), '{broken');
  assert.deepEqual(readSelection('concert', storage), {});
  saved.set(selectionKey('concert'), JSON.stringify({ version: 1, quantities: { [ticket.id]: -1, unknown: 5 } }));
  assert.deepEqual(readSelection('concert', storage), {});
  writeSelection('concert', {}, storage);
  assert.equal(saved.has(selectionKey('concert')), false);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(readSelection('concert', blocked), {});
  assert.doesNotThrow(() => writeSelection('concert', { [ticket.id]: 1 }, blocked));
});

test('reducer preserves selection on failures and removes it when sales end', () => {
  let state = initialSelection({ [ticket.id]: 5 });
  state = selectionReducer(state, { type: 'error' });
  assert.equal(state.quantities[ticket.id], 5);
  state = selectionReducer(state, { type: 'loaded', data: { concert: { id: 'c' }, ticketTypes: [{ ...ticket, max_per_order: 2, sale_end: new Date(now + 1000).toISOString() }] }, now });
  assert.equal(state.quantities[ticket.id], 2);
  assert.match(state.notice, /điều chỉnh/);
  state = selectionReducer(state, { type: 'select', id: ticket.id, quantity: 99, now });
  assert.equal(state.quantities[ticket.id], 2);
  const sameQuantities = state.quantities;
  state = selectionReducer(state, { type: 'tick', now: now + 500 });
  assert.equal(state.quantities, sameQuantities, 'unchanged selection avoids repeated storage writes');
  state = selectionReducer(state, { type: 'tick', now: now + 1000 });
  assert.deepEqual(state.quantities, {});
  state = selectionReducer(state, { type: 'select', id: ticket.id, quantity: 1, now: now + 1000 });
  assert.deepEqual(state.quantities, {});
});
