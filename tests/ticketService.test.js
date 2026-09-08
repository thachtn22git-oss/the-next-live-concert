import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { fetchTicketCatalog } from '../src/features/tickets/services/ticketService.js';

function mockClient(responses, requests) {
  return createClient('https://ticket-test.supabase.co', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      const url = new URL(input);
      requests.push({ url, options });
      const response = responses[url.pathname.split('/').pop()];
      return new globalThis.Response(JSON.stringify(response.body ?? response), {
        status: response.status ?? 200, headers: { 'Content-Type': 'application/json' },
      });
    } },
  });
}

test('ticket query selects active types for one published concert in stable order', async () => {
  const requests = [];
  const controller = new globalThis.AbortController();
  const client = mockClient({ concerts: [{ id: 'c' }], ticket_types: [{ id: 't' }] }, requests);
  const result = await fetchTicketCatalog({ client, slug: 'the-next-live-concert-2026', signal: controller.signal });
  assert.equal(result.ticketTypes[0].id, 't');
  assert.equal(requests[0].url.searchParams.get('slug'), 'eq.the-next-live-concert-2026');
  assert.equal(requests[0].url.searchParams.get('is_published'), 'eq.true');
  assert.equal(requests[1].url.searchParams.get('concert_id'), 'eq.c');
  assert.equal(requests[1].url.searchParams.get('is_active'), 'eq.true');
  assert.equal(requests[1].url.searchParams.get('order'), 'display_order.asc,id.asc');
  assert.equal(requests[1].options.signal, controller.signal);
  assert.equal(requests.every(request => request.options.method === 'GET'), true);
});

test('unpublished/missing concerts return empty without querying ticket types', async () => {
  const requests = [];
  assert.deepEqual(await fetchTicketCatalog({ client: mockClient({ concerts: [] }, requests) }), { concert: null, ticketTypes: [] });
  assert.equal(requests.length, 1);
});

test('ticket query failures are not treated as empty availability', async () => {
  await assert.rejects(fetchTicketCatalog({ client: mockClient({
    concerts: [{ id: 'c' }],
    ticket_types: { status: 403, body: { code: '42501', message: 'Denied' } },
  }, []) }), error => error.code === '42501');
  await assert.rejects(fetchTicketCatalog({ client: null }), /not configured/);
});
