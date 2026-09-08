import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext } from '../src/contexts/AuthContext.js';
import TicketSelectionProvider from '../src/features/tickets/context/TicketSelectionProvider.jsx';
import TicketsPage from '../src/pages/TicketsPage.jsx';

const h = React.createElement;
const ticket = {
  id: '50000000-0000-4000-8000-000000000001', slug: 'standard', name: 'STANDARD',
  price: 499000, total_quantity: 1000, sold_quantity: 0, max_per_order: 2,
  is_active: true, sale_start: null, sale_end: null,
};
const catalog = { concert: { id: 'c', name: 'The Next', starts_at: '2026-11-21T16:00:00+07:00', venue: 'Đà Nẵng' }, ticketTypes: [ticket] };

function Destination() {
  const location = useLocation();
  return h('p', null, location.pathname + ' from=' + (location.state?.from || ''));
}

function setupWindow() {
  const original = globalThis.window;
  const values = new Map();
  const listeners = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  globalThis.window = {
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval,
    AbortController: globalThis.AbortController,
    addEventListener: (event, listener) => listeners.set(event, listener),
    removeEventListener: event => listeners.delete(event),
  };
  return { storage, restore: () => { globalThis.window = original; } };
}

async function renderTickets(storage, user = null, loader = async () => catalog) {
  let view;
  await act(async () => {
    view = create(h(AuthContext.Provider, { value: { status: 'ready', user } },
      h(TicketSelectionProvider, { storage, loader },
        h(MemoryRouter, { initialEntries: ['/tickets'], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
          h(Routes, null,
            h(Route, { path: '/tickets', element: h(TicketsPage) }),
            h(Route, { path: '/login', element: h(Destination) }),
            h(Route, { path: '/checkout', element: h(Destination) }),
          ),
        ),
      ),
    ));
  });
  return view;
}

function continueButton(view) {
  return view.root.findAllByType('button').find(button => React.Children.toArray(button.props.children).includes('Tiếp tục thanh toán'));
}

test('ticket controls enforce limits, summary updates, guest continue retains checkout return path', async () => {
  const environment = setupWindow();
  let view;
  try {
    view = await renderTickets(environment.storage);
    assert.equal(continueButton(view).props.disabled, true);
    const minus = () => view.root.findByProps({ 'aria-label': 'Giảm số lượng vé Tiêu chuẩn' });
    const plus = () => view.root.findByProps({ 'aria-label': 'Tăng số lượng vé Tiêu chuẩn' });
    assert.equal(minus().props.disabled, true);
    await act(async () => { plus().props.onClick(); });
    assert.equal(continueButton(view).props.disabled, false);
    await act(async () => { plus().props.onClick(); });
    assert.equal(plus().props.disabled, true);
    assert.match(JSON.stringify(view.toJSON()), /998.000đ/);
    await act(async () => { continueButton(view).props.onClick(); });
    assert.match(JSON.stringify(view.toJSON()), /\/login from=\/checkout/);
    act(() => view.unmount());
    view = await renderTickets(environment.storage, { id: 'user' });
    assert.match(JSON.stringify(view.toJSON()), /998.000đ/);
    assert.equal(continueButton(view).props.disabled, false);
    await act(async () => { continueButton(view).props.onClick(); });
    assert.match(JSON.stringify(view.toJSON()), /\/checkout from=/);
  } finally { if (view) act(() => view.unmount()); environment.restore(); }
});

test('stock changes during continue clear invalid quantities and prevent navigation', async () => {
  const environment = setupWindow();
  let view;
  let reads = 0;
  try {
    view = await renderTickets(environment.storage, null, async () => ++reads === 1 ? catalog : {
      ...catalog, ticketTypes: [{ ...ticket, sold_quantity: ticket.total_quantity }],
    });
    await act(async () => { view.root.findByProps({ 'aria-label': 'Tăng số lượng vé Tiêu chuẩn' }).props.onClick(); });
    await act(async () => { continueButton(view).props.onClick(); });
    assert.match(JSON.stringify(view.toJSON()), /Hết vé/);
    assert.match(JSON.stringify(view.toJSON()), /Thông tin vé vừa thay đổi/);
    assert.equal(continueButton(view).props.disabled, true);
    act(() => view.unmount());
    view = await renderTickets(environment.storage);
    assert.equal(continueButton(view).props.disabled, true, 'invalid quantities were removed from session storage');
  } finally { if (view) act(() => view.unmount()); environment.restore(); }
});

test('sale windows disable controls and catalog errors offer Vietnamese retry', async () => {
  const environment = setupWindow();
  let view;
  try {
    view = await renderTickets(environment.storage, null, async () => ({
      ...catalog, ticketTypes: [{ ...ticket, sale_start: new Date(Date.now() + 60000).toISOString() }],
    }));
    assert.match(JSON.stringify(view.toJSON()), /Chưa mở bán/);
    assert.equal(view.root.findByProps({ 'aria-label': 'Tăng số lượng vé Tiêu chuẩn' }).props.disabled, true);
    act(() => view.unmount());
    view = await renderTickets(environment.storage, null, async () => { throw new Error('private server diagnostics'); });
    assert.match(JSON.stringify(view.toJSON()), /Chưa thể tải thông tin vé/);
    assert.doesNotMatch(JSON.stringify(view.toJSON()), /private server diagnostics/);
    assert.equal(view.root.findAllByType('button').some(button => React.Children.toArray(button.props.children).includes('Thử lại')), true);
  } finally { if (view) act(() => view.unmount()); environment.restore(); }
});
