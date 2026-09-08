import { supabase } from '../../lib/supabase.js';
import { CONCERT_SLUG } from '../../constants/concert.js';
import { searchTerm } from './adminModel.js';

export const PAGE_SIZE = 20;
const ticketFields = 'id,ticket_code,ticket_name,concert_name,concert_starts_at,venue,status,issued_at,used_at,order:orders(order_code)';
export function createAdminService(client = supabase) {
  const db = () => { if (!client) throw new Error('Not configured'); return client; };
  async function unwrap(query) { const { data, error } = await query; if (error) throw error; return data; }
  return {
    rpc: (name, args) => unwrap(db().rpc(name, args)),
    concert: () => unwrap(db().from('concerts').select('*').eq('slug', CONCERT_SLUG).maybeSingle()),
    get: (table, id) => unwrap(db().from(table).select('*').eq('id', id).maybeSingle()),
    async list(table, { page = 0, concertId, search = '', status = '', payment = '' } = {}) {
      let q = db().from(table).select(table === 'tickets' ? ticketFields : table === 'concert_artists' ? '*,artist:artists(name)' : '*', { count: 'exact' });
      if (concertId) q = q.eq('concert_id', concertId);
      if (status) q = q.eq('status', status);
      if (payment) q = q.eq('payment_status', payment);
      const term = searchTerm(search);
      if (term && table === 'orders') q = q.or(['order_code','customer_name','customer_email','customer_phone'].map(key => `${key}.ilike.%${term}%`).join(','));
      if (term && table === 'tickets') q = q.ilike('ticket_code', `%${term}%`);
      if (term && table === 'artists') q = q.ilike('name', `%${term}%`);
      const sort = table === 'tickets' ? 'issued_at' : table === 'orders' ? 'created_at' : table === 'schedules' ? 'starts_at' : table === 'concert_artists' || table === 'ticket_types' ? 'display_order' : 'name';
      q = q.order(sort, { ascending: !['orders','tickets'].includes(table) }).order(table === 'concert_artists' ? 'artist_id' : 'id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const result = await q; if (result.error) throw result.error; return { rows: result.data || [], count: result.count || 0 };
    },
    save: (table, data, row) => {
      let q = row ? db().from(table).update(data) : db().from(table).insert(data);
      if (row) q = table === 'concert_artists' ? q.eq('concert_id', row.concert_id).eq('artist_id', row.artist_id) : q.eq('id', row.id);
      return unwrap(q.select().single());
    },
    remove: (table, row) => {
      let q = db().from(table).delete();
      q = table === 'concert_artists' ? q.eq('concert_id',row.concert_id).eq('artist_id',row.artist_id) : q.eq('id',row.id);
      return unwrap(q.select().single());
    },
    order: code => unwrap(db().from('orders').select('*,order_items(*)').eq('order_code', code).maybeSingle()),
    ticketCount: async id => { const r = await db().from('tickets').select('id', { count: 'exact', head: true }).eq('order_id', id); if (r.error) throw r.error; return r.count; },
  };
}
export const adminService = createAdminService();
