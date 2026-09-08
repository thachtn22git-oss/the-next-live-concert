import { supabase } from '../../../lib/supabase.js';
import { CONCERT_SLUG } from '../../../constants/concert.js';

export async function fetchTicketCatalog({ client = supabase, signal, slug = CONCERT_SLUG } = {}) {
  if (!client) throw new Error('Ticket data is not configured.');
  const concertResult = await client.from('concerts')
    .select('id, slug, name, venue, starts_at, ends_at, is_sample')
    .eq('slug', slug).eq('is_published', true).abortSignal(signal).maybeSingle();
  if (concertResult.error) throw concertResult.error;
  if (!concertResult.data) return { concert: null, ticketTypes: [] };
  const { data, error } = await client.from('ticket_types')
    .select('id, concert_id, name, slug, description, price, total_quantity, sold_quantity, max_per_order, sale_start, sale_end, is_active, display_order')
    .eq('concert_id', concertResult.data.id).eq('is_active', true)
    .order('display_order').order('id').abortSignal(signal);
  if (error) throw error;
  return { concert: concertResult.data, ticketTypes: data ?? [] };
}
