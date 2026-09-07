import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { fetchConcertProgram } from '../src/services/concertService.js';
import { formatConcertTime, formatConcertDate, safePublicUrl } from '../src/utils/concert.js';

const concert = { id: 'concert-1', name: 'The Next', is_sample: true };
const artist = { id: 'artist-1', slug: 'an-nhien', name: 'An Nhiên' };
const slots = [
  { id: 'opening', artist_id: null, starts_at: '2026-11-21T09:00:00Z' },
  { id: 'show', artist_id: artist.id, starts_at: '2026-11-21T12:30:00Z' },
];

function mockClient(responses, requests = []) {
  return createClient('https://concert-test.supabase.co', 'test-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, options) => {
        const url = new URL(input);
        requests.push({ url, options });
        const table = url.pathname.split('/').pop();
        const response = responses[table];
        if (response instanceof Error) throw response;
        return new globalThis.Response(JSON.stringify(response?.body ?? response), {
          status: response?.status ?? 200, headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });
}

test('queries one published concert, scopes children and associates performances', async () => {
  const requests = [];
  const client = mockClient({
    concerts: [concert],
    concert_artists: [{ artist, billing: 'Nghệ sĩ chính', is_featured: true }, { artist: null }],
    schedules: slots,
  }, requests);
  const result = await fetchConcertProgram({ client, slug: 'the-next-live-concert-2026' });
  assert.equal(result.artists.length, 1);
  assert.equal(result.artists[0].performances[0].id, 'show');
  assert.equal(result.schedules[0].artist, null);
  assert.equal(result.schedules[1].artist.slug, 'an-nhien');
  assert.equal(requests[0].url.searchParams.get('slug'), 'eq.the-next-live-concert-2026');
  assert.equal(requests[0].url.searchParams.get('is_published'), 'eq.true');
  for (const request of requests.slice(1)) {
    assert.equal(request.url.searchParams.get('concert_id'), 'eq.concert-1');
  }
  assert.equal(requests.find(r => r.url.pathname.endsWith('schedules')).url.searchParams.get('order'), 'starts_at.asc,id.asc');
});

test('missing or unpublished concert is empty and never loads children', async () => {
  const requests = [];
  const result = await fetchConcertProgram({ client: mockClient({ concerts: [] }, requests) });
  assert.deepEqual(result, { concert: null, artists: [], schedules: [] });
  assert.equal(requests.length, 1);
});

test('published concert with no artists or schedule produces empty collections', async () => {
  const result = await fetchConcertProgram({ client: mockClient({ concerts: [concert], concert_artists: [], schedules: [] }) });
  assert.deepEqual(result.artists, []);
  assert.deepEqual(result.schedules, []);
});

test('database failures propagate instead of appearing as empty data', async () => {
  await assert.rejects(fetchConcertProgram({
    client: mockClient({ concerts: [concert], concert_artists: [], schedules: { status: 403, body: { message: 'Denied', code: '42501' } } }),
  }), error => error.code === '42501');
});

test('missing configuration is recoverable and does not make a request', async () => {
  await assert.rejects(fetchConcertProgram({ client: null }), /not configured/);
});

test('aborted requests fail instead of returning stale content', async () => {
  const controller = new globalThis.AbortController();
  controller.abort();
  const client = createClient('https://concert-test.supabase.co', 'test-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (_input, options) => {
      assert.equal(options.signal.aborted, true);
      throw new globalThis.DOMException('Aborted', 'AbortError');
    } },
  });
  await assert.rejects(fetchConcertProgram({ client, signal: controller.signal }));
});

test('Vietnam dates and times are independent of host timezone', () => {
  assert.equal(formatConcertTime('2026-11-21T12:30:00Z'), '19:30');
  assert.equal(formatConcertDate('2026-11-21T18:30:00Z'), '22/11/2026');
  assert.equal(formatConcertTime(null), 'Chưa công bố');
  assert.equal(formatConcertTime('invalid'), 'Chưa công bố');
});

test('social URLs reject script schemes, credentials and malformed values', () => {
  assert.equal(safePublicUrl('javascript:alert(1)'), null);
  assert.equal(safePublicUrl('data:text/html,test'), null);
  assert.equal(safePublicUrl('https://user:password@example.com'), null);
  assert.equal(safePublicUrl({}), null);
  assert.equal(safePublicUrl('https://example.com'), 'https://example.com/');
});
