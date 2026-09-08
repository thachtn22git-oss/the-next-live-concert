import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createOrderService } from '../src/features/orders/services/orderService.js';
import { validateCustomer, orderErrorMessage, orderSummary } from '../src/features/orders/utils/orders.js';
import { readOrderRequest, saveOrderRequest, clearOrderRequest } from '../src/features/orders/utils/requestStorage.js';

function mockService(body, requests, status = 200) {
  return createOrderService(createClient('https://order-test.supabase.co', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      requests.push({ url: new URL(input), options });
      return new globalThis.Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  }));
}

test('order RPC sends only customer data, ticket IDs, quantities and idempotency ID', async () => {
  const requests = [];
  const signal = new globalThis.AbortController().signal;
  const result = await mockService({ order_code: 'TNL-TEST' }, requests).createOrder({
    concertId: 'concert', userId: 'spoofed', total_amount: 1, requestId: 'request',
    customer: { fullName: ' An Nguyen ', email: ' AN@example.com ', phone: '090 123 4567' },
    items: [{ ticket_type_id: 'ticket', quantity: 2, unit_price: 1, subtotal: 2, sold_quantity: 0 }],
  }, signal);
  assert.equal(result.order_code, 'TNL-TEST');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].url.pathname, '/rest/v1/rpc/create_order');
  assert.equal(requests[0].options.signal, signal);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    p_concert_id: 'concert', p_customer_name: 'An Nguyen', p_customer_email: 'an@example.com',
    p_customer_phone: '0901234567', p_request_id: 'request', p_items: [{ ticket_type_id: 'ticket', quantity: 2 }],
  });
});

test('order queries filter authenticated owner and request immutable item snapshots', async () => {
  const requests = [];
  const service = mockService([{ order_code: 'TNL-TEST' }], requests);
  assert.equal((await service.getOrder('TNL-TEST', 'owner')).order_code, 'TNL-TEST');
  await service.findRequest('request', 'owner');
  assert.equal(requests[0].url.searchParams.get('order_code'), 'eq.TNL-TEST');
  assert.match(requests[0].url.searchParams.get('select'), /order_items\(ticket_type_id,ticket_name,quantity,unit_price,subtotal\)/);
  assert.equal(requests[1].url.searchParams.get('request_id'), 'eq.request');
  assert.equal(requests.every(({ url, options }) => url.searchParams.get('user_id') === 'eq.owner' && options.method === 'GET'), true);
  assert.equal(await mockService([], []).getOrder('unknown', 'owner'), null);
});

test('order service propagates codes but UI messages never expose server diagnostics', async () => {
  await assert.rejects(mockService({ code: 'TN009', message: 'private diagnostics' }, [], 400).createOrder({
    concertId: 'c', customer: { fullName: 'An', email: 'an@example.com', phone: '0901234567' }, items: [], requestId: 'r',
  }), error => error.code === 'TN009');
  assert.match(orderErrorMessage({ code: 'TN009' }), /Số lượng vé còn lại đã thay đổi/);
  assert.match(orderErrorMessage({ code: 'TN008' }), /vừa hết/);
  assert.match(orderErrorMessage({ code: 'TN006' }), /đã kết thúc/);
  assert.match(orderErrorMessage({ code: 'TN001' }), /đăng nhập/);
  assert.equal(orderErrorMessage({ message: 'private diagnostics' }), 'Chưa thể tạo đơn đặt vé. Vui lòng thử lại.');
  assert.throws(() => createOrderService(null).getOrder('code', 'owner'), /not configured/);
});

test('customer validation and order summary use saved amounts rather than current catalog', () => {
  assert.deepEqual(validateCustomer({ fullName: 'An Nguyen', email: 'an@example.com', phone: '+84 901 234 567' }), {});
  assert.deepEqual(Object.keys(validateCustomer({ fullName: ' ', email: 'invalid', phone: 'abc' })), ['fullName', 'email', 'phone']);
  assert.ok(validateCustomer({ fullName: 'a'.repeat(121), email: 'an@example.com', phone: '123' }).fullName);
  const summary = orderSummary({ total_quantity: 2, total_amount: '998000', order_items: [
    { ticket_type_id: 't', ticket_name: 'STANDARD', quantity: 2, unit_price: 499000, subtotal: '998000' },
  ] });
  assert.equal(summary.totalQuantity, 2);
  assert.equal(summary.totalAmount, 998000);
  assert.equal(summary.items[0].ticket.price, 499000);
  assert.equal(summary.items[0].subtotal, 998000);
});

test('request persistence stores only UUID, isolates users and tolerates unavailable storage', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const id = '50000000-0000-4000-8000-000000000001';
  saveOrderRequest('a', id, storage);
  assert.equal(readOrderRequest('a', storage), id);
  assert.equal(readOrderRequest('b', storage), null);
  assert.deepEqual([...values.values()], [id]);
  clearOrderRequest('a', storage);
  assert.equal(readOrderRequest('a', storage), null);
  saveOrderRequest('a', 'invalid', storage);
  assert.equal(readOrderRequest('a', storage), null);
  assert.equal(readOrderRequest('a', null), null);
  assert.doesNotThrow(() => saveOrderRequest('a', id, null));
});
