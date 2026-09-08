import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext } from '../src/contexts/AuthContext.js';
import { TicketSelectionContext } from '../src/features/tickets/context/TicketSelectionContext.js';
import { selectionSummary } from '../src/features/tickets/utils/tickets.js';
import { saveOrderRequest, readOrderRequest } from '../src/features/orders/utils/requestStorage.js';
import CheckoutPage from '../src/pages/CheckoutPage.jsx';
import OrderSuccessPage from '../src/pages/OrderSuccessPage.jsx';

const h = React.createElement;
const user = { id: 'owner', email: 'an@example.com' };
const profile = { full_name: 'An Nguyen', phone: '0901234567' };
const ticket = {
  id: '50000000-0000-4000-8000-000000000001', slug: 'standard', name: 'STANDARD',
  price: 499000, total_quantity: 1000, sold_quantity: 0, max_per_order: 6,
  is_active: true, sale_start: null, sale_end: null,
};
const requestId = '50000000-0000-4000-8000-000000000002';
const prevented = { preventDefault() {} };
function Destination() { return h('p', null, useLocation().pathname); }

function environment() {
  const original = globalThis.window;
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.window = { sessionStorage: storage, AbortController: globalThis.AbortController,
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  return { storage, restore: () => { globalThis.window = original; } };
}

async function renderCheckout({ service, count = 2, clearSelection = () => {} }) {
  const quantities = count ? { [ticket.id]: count } : {};
  const selection = { concert: { id: 'concert' }, status: 'success', ticketTypes: [ticket], quantities,
    summary: selectionSummary(quantities, [ticket]), refresh() {}, clearSelection };
  let view;
  await act(async () => {
    view = create(h(AuthContext.Provider, { value: { user, profile } },
      h(TicketSelectionContext.Provider, { value: selection },
        h(MemoryRouter, { initialEntries: ['/checkout'], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
          h(Routes, null, h(Route, { path: '/checkout', element: h(CheckoutPage, { service }) }),
            h(Route, { path: '/order-success/:code', element: h(Destination) }))))));
  });
  return view;
}
const confirm = view => view.root.findAllByType('button').find(button => button.props.type === 'submit');

test('checkout prefills customer, displays total, validates form, and shows empty selection', async () => {
  const env = environment();
  let view;
  let calls = 0;
  try {
    const service = { createOrder: async () => { calls++; } };
    view = await renderCheckout({ service });
    assert.equal(view.root.findByType('form').props.noValidate, true);
    assert.equal(view.root.findAllByType('input').find(input => input.props.name === 'fullName').props.value, profile.full_name);
    assert.equal(view.root.findAllByType('input').find(input => input.props.name === 'email').props.value, user.email);
    assert.match(JSON.stringify(view.toJSON()), /998.000đ/);
    await act(async () => view.root.findAllByType('input').find(input => input.props.name === 'phone').props.onChange({ target: { name: 'phone', value: '' } }));
    await act(async () => view.root.findByType('form').props.onSubmit(prevented));
    assert.equal(calls, 0);
    assert.match(JSON.stringify(view.toJSON()), /Vui lòng nhập số điện thoại hợp lệ/);
    act(() => view.unmount());
    view = await renderCheckout({ service, count: 0 });
    assert.equal(view.root.findAllByType('form').length, 0);
    assert.match(JSON.stringify(view.toJSON()), /Bạn chưa có lựa chọn vé hợp lệ/);
  } finally { if (view) act(() => view.unmount()); env.restore(); }
});

test('checkout prevents double submit, preserves selection on error, reuses request ID and clears on success', async () => {
  const env = environment();
  let view;
  let cleared = 0;
  let reject;
  const calls = [];
  const service = { createOrder: payload => {
    calls.push(payload);
    return calls.length === 1 ? new Promise((resolve, fail) => { reject = fail; }) : Promise.resolve({ order_code: 'TNL-TEST' });
  } };
  try {
    view = await renderCheckout({ service, clearSelection: () => { cleared++; } });
    const submit = view.root.findByType('form').props.onSubmit;
    let attempt;
    await act(async () => { attempt = submit(prevented); submit(prevented); });
    assert.equal(calls.length, 1);
    assert.equal(confirm(view).props.disabled, true);
    assert.match(JSON.stringify(view.toJSON()), /Đang xử lý đơn đặt vé/);
    assert.equal(cleared, 0);
    assert.equal(readOrderRequest(user.id, env.storage), calls[0].requestId);
    await act(async () => { reject({ code: 'TN009', message: 'private diagnostics' }); await attempt; });
    assert.equal(cleared, 0);
    assert.equal(confirm(view).props.disabled, false);
    assert.match(JSON.stringify(view.toJSON()), /998.000đ/);
    assert.match(JSON.stringify(view.toJSON()), /Số lượng vé còn lại đã thay đổi/);
    assert.doesNotMatch(JSON.stringify(view.toJSON()), /private diagnostics/);
    await act(async () => view.root.findByType('form').props.onSubmit(prevented));
    assert.equal(calls.length, 2);
    assert.equal(calls[0].requestId, calls[1].requestId);
    assert.deepEqual(calls[0].items, [{ ticket_type_id: ticket.id, quantity: 2 }]);
    assert.equal(cleared, 1);
    assert.equal(readOrderRequest(user.id, env.storage), null);
    assert.match(JSON.stringify(view.toJSON()), /\/order-success\/TNL-TEST/);
  } finally { if (view) act(() => view.unmount()); env.restore(); }
});

test('checkout recovers committed request after reload even when selection is now invalid', async () => {
  const env = environment();
  let view;
  let cleared = 0;
  try {
    saveOrderRequest(user.id, requestId, env.storage);
    view = await renderCheckout({ count: 0, clearSelection: () => { cleared++; }, service: {
      findRequest: async (id, owner) => {
        assert.equal(id, requestId); assert.equal(owner, user.id);
        return { order_code: 'TNL-RECOVERED' };
      },
      createOrder: () => { assert.fail('Recovery must not create another order'); },
    } });
    assert.equal(cleared, 1);
    assert.equal(readOrderRequest(user.id, env.storage), null);
    assert.match(JSON.stringify(view.toJSON()), /\/order-success\/TNL-RECOVERED/);
  } finally { if (view) act(() => view.unmount()); env.restore(); }
});

test('success page fetches own order, ignores navigation state and handles missing/error/loading', async () => {
  const env = environment();
  let view;
  let resolve;
  const calls = [];
  const service = { getOrder: (code, owner) => {
    calls.push({ code, owner });
    return new Promise(done => { resolve = done; });
  } };
  async function render(activeService) {
    await act(async () => {
      view = create(h(AuthContext.Provider, { value: { user } },
        h(MemoryRouter, { initialEntries: [{ pathname: '/order-success/TNL-TEST', state: { total_amount: 1, payment_status: 'paid' } }], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
          h(Routes, null, h(Route, { path: '/order-success/:orderCode', element: h(OrderSuccessPage, { service: activeService }) })))));
    });
  }
  try {
    await render(service);
    assert.match(JSON.stringify(view.toJSON()), /Đang tải thông tin/);
    assert.deepEqual(calls, [{ code: 'TNL-TEST', owner: 'owner' }]);
    await act(async () => resolve({ order_code: 'TNL-TEST', customer_name: profile.full_name, customer_email: user.email,
      customer_phone: profile.phone, status: 'pending', payment_status: 'unpaid', total_quantity: 2, total_amount: '998000',
      order_items: [{ ticket_type_id: ticket.id, ticket_name: 'STANDARD', quantity: 2, unit_price: 499000, subtotal: '998000' }] }));
    assert.match(JSON.stringify(view.toJSON()), /998.000đ/);
    assert.match(JSON.stringify(view.toJSON()), /Chờ xác nhận/);
    assert.match(JSON.stringify(view.toJSON()), /Chưa thanh toán/);
    assert.doesNotMatch(JSON.stringify(view.toJSON()), /Đã thanh toán/);
    act(() => view.unmount());
    await render({ getOrder: async () => null });
    assert.match(JSON.stringify(view.toJSON()), /Không tìm thấy đơn đặt vé/);
    act(() => view.unmount());
    await render({ getOrder: () => { throw new Error('private error'); } });
    assert.match(JSON.stringify(view.toJSON()), /Chưa thể tải thông tin/);
    assert.doesNotMatch(JSON.stringify(view.toJSON()), /private error/);
  } finally { if (view) act(() => view.unmount()); env.restore(); }
});
