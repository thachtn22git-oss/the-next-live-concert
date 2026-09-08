import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { createDigitalTicketService } from '../src/features/tickets/services/digitalTicketService.js';
import { groupTickets, hasUsableQr, ticketStatusLabel, verificationMessage, verificationUrl } from '../src/features/tickets/utils/digitalTickets.js';

const token = '60000000-0000-4000-8000-000000000001';
function mockService(body, requests, status = 200) {
  return createDigitalTicketService(createClient('https://ticket-test.supabase.co', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      requests.push({ url: new URL(input), options });
      return new globalThis.Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  }));
}

test('digital ticket reads are filtered by owner in database with bounded stable pagination', async () => {
  const requests = [];
  const signal = new globalThis.AbortController().signal;
  const service = mockService(Array.from({ length: 25 }, (_, i) => ({ ticket_code: 'TKT-' + i })), requests);
  const result = await service.getMyTickets('owner', 1, signal);
  assert.equal(result.tickets.length, 24); assert.equal(result.hasNext, true);
  const { url, options } = requests[0];
  assert.equal(url.pathname, '/rest/v1/tickets');
  assert.equal(url.searchParams.get('user_id'), 'eq.owner');
  assert.equal(url.searchParams.get('order'), 'issued_at.desc,id.desc');
  assert.equal(url.searchParams.get('offset'), '24');
  assert.equal(url.searchParams.get('limit'), '25');
  assert.equal(options.method, 'GET'); assert.equal(options.signal, signal);
  assert.doesNotMatch(url.searchParams.get('select'), /customer_|total_amount|user_id/);
  assert.equal((await mockService([], []).getMyTickets('owner')).hasNext, false);
  await assert.rejects(service.getMyTickets(null), /Authentication required/);
  await assert.rejects(service.getMyTickets('owner', -1), /Invalid page/);
});

test('individual ticket query needs owner and code; missing tickets are not query errors', async () => {
  const requests = [];
  const service = mockService([{ ticket_code: 'TNL-TKT-A' }], requests);
  assert.equal((await service.getMyTicketByCode('TNL-TKT-A', 'owner')).ticket_code, 'TNL-TKT-A');
  assert.equal(requests[0].url.searchParams.get('ticket_code'), 'eq.TNL-TKT-A');
  assert.equal(requests[0].url.searchParams.get('user_id'), 'eq.owner');
  assert.equal(await mockService([], []).getMyTicketByCode('unknown', 'owner'), null);
  await assert.rejects(mockService({ message: 'private diagnostics' }, [], 500).getMyTickets('owner'));
  await assert.rejects(createDigitalTicketService(null).getMyTickets('owner'), /not configured/);
});

test('verification sends only token to RPC and rejects malformed tokens without a request', async () => {
  const requests = [];
  const safe = { is_valid: true, ticket_code: 'TNL-TKT-A', ticket_name: 'VIP', status: 'valid' };
  const service = mockService([safe], requests);
  assert.deepEqual(await service.verifyTicket(token), safe);
  assert.equal(requests[0].url.pathname, '/rest/v1/rpc/verify_ticket');
  assert.deepEqual(JSON.parse(requests[0].options.body), { p_token: token });
  assert.equal(await service.verifyTicket('bad-token'), null);
  assert.equal(requests.length, 1);
  assert.equal(await mockService([], []).verifyTicket(token), null);
});

test('status, eligibility, concert grouping and verification mapping fail closed', () => {
  assert.deepEqual(['valid', 'used', 'cancelled'].map(ticketStatusLabel), ['Hợp lệ', 'Đã sử dụng', 'Đã hủy']);
  assert.equal(ticketStatusLabel('unexpected'), 'Chưa xác định');
  const valid = { status: 'valid', order: { status: 'confirmed', payment_status: 'paid' } };
  assert.equal(hasUsableQr(valid), true);
  for (const ticket of [{ ...valid, status: 'used' }, { ...valid, status: 'cancelled' }, { status: 'valid' },
    { ...valid, order: { status: 'pending', payment_status: 'paid' } }, { ...valid, order: { status: 'confirmed', payment_status: 'unpaid' } }]) assert.equal(hasUsableQr(ticket), false);
  assert.deepEqual(groupTickets([]), []);
  const grouped = groupTickets([{ concert_id: 'a', concert_name: 'A' }, { concert_id: 'b', concert_name: 'B' }, { concert_id: 'a', concert_name: 'A' }]);
  assert.deepEqual(grouped.map(group => [group.name, group.tickets.length]), [['A', 2], ['B', 1]]);
  assert.equal(verificationMessage(null), 'Không tìm thấy vé.');
  assert.equal(verificationMessage({ is_valid: true, status: 'valid' }), 'Vé hợp lệ');
  assert.equal(verificationMessage({ is_valid: false, status: 'valid' }), 'Vé không hợp lệ.');
  assert.equal(verificationMessage({ status: 'used' }), 'Vé đã được sử dụng.');
  assert.equal(verificationMessage({ status: 'cancelled' }), 'Vé đã bị hủy.');
});

test('QR is a locally generated PNG containing only current origin and opaque token URL', async () => {
  const url = verificationUrl(token, 'https://concert.example/path?email=private@example.com');
  assert.equal(url, 'https://concert.example/verify-ticket/' + token);
  assert.equal(verificationUrl(token, 'http://localhost:5173'), 'http://localhost:5173/verify-ticket/' + token);
  assert.throws(() => verificationUrl('not-a-token', 'https://concert.example'));
  assert.throws(() => verificationUrl(token, 'javascript:alert(1)'));
  assert.throws(() => verificationUrl(token, 'https://user:password@concert.example'));
  const qr = QRCode.create(url);
  assert.equal(qr.modules.data.some(value => value === 1), true);
  assert.equal(qr.modules.data.some(value => value === 0), true);
  assert.equal(qr.segments.map(segment => typeof segment.data === 'string' ? segment.data : new globalThis.TextDecoder().decode(segment.data)).join(''), url);
  assert.match(await QRCode.toDataURL(url, { width: 512, margin: 4 }), /^data:image\/png;base64,iVBOR/);
});
