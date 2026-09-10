import { supabase } from '../../../lib/supabase.js';
import { isVerificationToken } from '../utils/digitalTickets.js';

export const DIGITAL_TICKET_PAGE_SIZE = 24;
const fields = 'ticket_code, verification_token, concert_id, concert_name, concert_starts_at, venue, ticket_name, status, issued_at, used_at, order:orders(order_code, status, payment_status)';

export function createDigitalTicketService(client = supabase) {
  function requireClient() {
    if (!client) throw new Error('Digital tickets are not configured');
    return client;
  }
  async function unwrap(query) {
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  return {
    async getMyTickets(userId, page = 0, signal) {
      if (!userId) throw new Error('Authentication required');
      if (!Number.isSafeInteger(page) || page < 0) throw new Error('Invalid page');
      const start = page * DIGITAL_TICKET_PAGE_SIZE;
      const rows = await unwrap(requireClient().from('tickets').select(fields).eq('user_id', userId)
        .order('issued_at', { ascending: false }).order('id', { ascending: false })
        .range(start, start + DIGITAL_TICKET_PAGE_SIZE).abortSignal(signal));
      return { tickets: rows.slice(0, DIGITAL_TICKET_PAGE_SIZE), hasNext: rows.length > DIGITAL_TICKET_PAGE_SIZE };
    },
    async getMyTicketByCode(code, userId, signal) {
      if (!userId) throw new Error('Authentication required');
      return unwrap(requireClient().from('tickets').select(fields).eq('ticket_code', code).eq('user_id', userId).abortSignal(signal).maybeSingle());
    },
    async verifyTicket(token, signal) {
      if (!isVerificationToken(token)) return null;
      const rows = await unwrap(requireClient().rpc('verify_ticket', { p_token: token }).abortSignal(signal));
      return rows?.[0] ?? null;
    },
  };
}

export const digitalTicketService = createDigitalTicketService();
