import test from 'node:test';
import assert from 'node:assert/strict';
import { manualPaymentDetails, transferReference } from '../src/features/orders/utils/manualPayment.js';

const now = Date.parse('2026-10-27T00:00:00Z');
const order = { order_code: 'TNL-20261027-577C947088124B90A49B', status: 'pending', payment_status: 'unpaid', total_amount: '1499000', expires_at: '2026-10-27T01:00:00Z' };

test('payment QR sends exact order amount and unique full memo to the designated account, without customer details', () => {
  const payment = manualPaymentDetails({ ...order, customer_email: 'private@example.com', customer_phone: 'private' }, now);
  const url = new URL(payment.qrUrl);
  assert.equal(url.origin, 'https://img.vietqr.io');
  assert.equal(url.pathname, '/image/970436-1031185809-compact2.png');
  assert.deepEqual(Object.fromEntries(url.searchParams), { amount: '1499000', addInfo: 'TNL20261027577C947088124B90A49B', accountName: 'TRAN NGOC THACH' });
  assert.equal(payment.reference, transferReference(order.order_code));
  assert.notEqual(payment.reference, transferReference(order.order_code.replace('A49B', 'A49C')));
});

test('payment QR is unavailable for expired, paid, cancelled, refunded or invalid orders', () => {
  for (const change of [
    { expires_at: '2026-10-27T00:00:00Z' }, { expires_at: null }, { expires_at: 'invalid' },
    { status: 'confirmed', payment_status: 'paid' }, { status: 'cancelled' }, { payment_status: 'refunded' },
    { expired_at: '2026-10-27T00:00:00Z' }, { inventory_released_at: '2026-10-27T00:00:00Z' },
    { total_amount: -1 }, { total_amount: 0 }, { total_amount: '1.5' }, { total_amount: 'invalid' }, { order_code: 'invalid' },
  ]) assert.equal(manualPaymentDetails({ ...order, ...change }, now), null);
});
