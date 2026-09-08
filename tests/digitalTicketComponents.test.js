import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../src/contexts/AuthContext.js';
import MyTicketsPage from '../src/pages/MyTicketsPage.jsx';
import MyTicketDetailPage from '../src/pages/MyTicketDetailPage.jsx';
import VerifyTicketPage from '../src/pages/VerifyTicketPage.jsx';
import DigitalTicketPass from '../src/features/tickets/components/DigitalTicketPass.jsx';
import TicketQrCode from '../src/features/tickets/components/TicketQrCode.jsx';

const h = React.createElement;
const token = '60000000-0000-4000-8000-000000000001';
const ticket = { ticket_code: 'TNL-TKT-A', verification_token: token, concert_id: 'concert', concert_name: 'The Next Live Concert',
  ticket_name: 'VIP', status: 'valid', concert_starts_at: '2026-11-21T18:00:00+07:00', venue: 'Đà Nẵng',
  order: { status: 'confirmed', payment_status: 'paid' } };
const future = { v7_startTransition: true, v7_relativeSplatPath: true };
function environment() {
  const original = globalThis.window;
  const location = globalThis.location;
  globalThis.window = { AbortController: globalThis.AbortController, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    addEventListener() {}, removeEventListener() {} };
  globalThis.location = { origin: 'http://localhost:5173' };
  return () => { globalThis.window = original; globalThis.location = location; };
}
async function renderPage(Page, service, path = '/my-tickets', route = '/my-tickets') {
  let view;
  await act(async () => {
    view = create(h(AuthContext.Provider, { value: { user: { id: 'owner' } } }, h(MemoryRouter, { initialEntries: [path], future },
      h(Routes, null, h(Route, { path: route, element: h(Page, { service }) })))));
  });
  return view;
}

test('My Tickets empty state, Vietnamese errors and pagination use server-loaded rows', async () => {
  const restore = environment();
  let view;
  try {
    view = await renderPage(MyTicketsPage, { getMyTickets: async owner => {
      assert.equal(owner, 'owner'); return { tickets: [], hasNext: false };
    } });
    assert.match(JSON.stringify(view.toJSON()), /Bạn chưa có vé nào/);
    assert.equal(view.root.findAllByType('a').some(a => a.props.href === '/tickets'), true);
    assert.equal(view.root.findAllByType(TicketQrCode).length, 0);
    act(() => view.unmount());
    view = await renderPage(MyTicketsPage, { getMyTickets: async (owner, page) => ({ tickets: [{ ...ticket, status: 'cancelled', ticket_code: 'TKT-' + page }], hasNext: page === 0 }) });
    assert.equal(view.root.findAllByType(DigitalTicketPass).length, 1);
    await act(async () => view.root.findByProps({ 'aria-label': 'Trang sau' }).props.onClick());
    assert.match(JSON.stringify(view.toJSON()), /TKT-1/);
    act(() => view.unmount());
    view = await renderPage(MyTicketsPage, { getMyTickets: () => { throw new Error('private SQL'); } });
    assert.match(JSON.stringify(view.toJSON()), /Chưa thể tải thông tin/);
    assert.doesNotMatch(JSON.stringify(view.toJSON()), /private SQL/);
  } finally { if (view) act(() => view.unmount()); restore(); }
});

test('only valid issued tickets from confirmed paid orders render QR component', async () => {
  const restore = environment();
  let view;
  try {
    for (const data of [ticket, { ...ticket, status: 'used' }, { ...ticket, status: 'cancelled' }, { ...ticket, order: { status: 'pending', payment_status: 'unpaid' } }]) {
      await act(async () => { view = create(h(MemoryRouter, { future }, h(DigitalTicketPass, { ticket: data, detail: true }))); });
      assert.equal(view.root.findAllByType(TicketQrCode).length, data === ticket ? 1 : 0);
      if (data !== ticket) assert.match(JSON.stringify(view.toJSON()), /Mã QR không khả dụng/);
      act(() => view.unmount()); view = null;
    }
  } finally { if (view) act(() => view.unmount()); restore(); }
});

test('individual ticket fetches owner and route code, shows loading and private not found', async () => {
  const restore = environment();
  let view;
  let resolve;
  try {
    view = await renderPage(MyTicketDetailPage, { getMyTicketByCode: (code, owner) => {
      assert.equal(code, 'TNL-TKT-A'); assert.equal(owner, 'owner'); return new Promise(done => { resolve = done; });
    } }, '/my-tickets/TNL-TKT-A', '/my-tickets/:ticketCode');
    assert.match(JSON.stringify(view.toJSON()), /Đang tải thông tin/);
    await act(async () => resolve({ ...ticket, status: 'used' }));
    assert.match(JSON.stringify(view.toJSON()), /Đã sử dụng/);
    assert.match(JSON.stringify(view.toJSON()), /21\/11\/2026/);
    act(() => view.unmount());
    view = await renderPage(MyTicketDetailPage, { getMyTicketByCode: async () => null }, '/my-tickets/OTHER', '/my-tickets/:ticketCode');
    assert.match(JSON.stringify(view.toJSON()), /không thuộc tài khoản/);
    assert.equal(view.root.findAllByType(TicketQrCode).length, 0);
  } finally { if (view) act(() => view.unmount()); restore(); }
});

test('public verification maps valid, used, cancelled and unknown without check-in controls', async () => {
  const restore = environment();
  let view;
  try {
    for (const [result, label] of [[{ ...ticket, is_valid: true }, 'Vé hợp lệ'], [{ ...ticket, status: 'used', is_valid: false }, 'Vé đã được sử dụng'], [{ ...ticket, status: 'cancelled', is_valid: false }, 'Vé đã bị hủy'], [null, 'Không tìm thấy vé']]) {
      view = await renderPage(VerifyTicketPage, { verifyTicket: async value => { assert.equal(value, token); return result; } }, '/verify-ticket/' + token, '/verify-ticket/:token');
      assert.match(JSON.stringify(view.toJSON()), new RegExp(label));
      assert.equal(view.root.findAllByType('button').length, 1);
      assert.equal(view.root.findAllByType(TicketQrCode).length, 0);
      act(() => view.unmount()); view = null;
    }
  } finally { if (view) act(() => view.unmount()); restore(); }
});

test('QR renderer gets only verification URL, preserves quiet zone and handles errors safely', async () => {
  const restore = environment();
  let view;
  try {
    await act(async () => { view = create(h(TicketQrCode, { token, renderQr: async (url, options) => {
      assert.equal(url, 'http://localhost:5173/verify-ticket/' + token);
      assert.equal(options.margin, 4); assert.equal(options.width, 512);
      return 'data:image/png;base64,test';
    } })); });
    assert.equal(view.root.findByType('img').props.alt, 'Mã QR xác minh vé');
    act(() => view.unmount());
    await act(async () => { view = create(h(TicketQrCode, { token, renderQr: () => { throw new Error('private data'); } })); });
    assert.match(JSON.stringify(view.toJSON()), /Chưa thể tạo mã QR/);
    assert.doesNotMatch(JSON.stringify(view.toJSON()), /private data/);
  } finally { if (view) act(() => view.unmount()); restore(); }
});
