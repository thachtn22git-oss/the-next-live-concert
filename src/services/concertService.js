import { supabase } from '../lib/supabase.js';
import { CONCERT_SLUG } from '../constants/concert.js';

const emptyProgram = () => ({ concert: null, artists: [], schedules: [] });

export async function fetchConcertProgram({ signal, client = supabase, slug = CONCERT_SLUG } = {}) {
  if (!client) throw new Error('Public concert data is not configured.');
  const concertResult = await client.from('concerts')
    .select('id, slug, name, description, venue, starts_at, ends_at, is_sample')
    .eq('slug', slug).eq('is_published', true).abortSignal(signal).maybeSingle();
  if (concertResult.error) throw concertResult.error;
  if (!concertResult.data) return emptyProgram();
  const concert = concertResult.data;
  const [artistResult, scheduleResult] = await Promise.all([
    client.from('concert_artists')
      .select('display_order, billing, is_featured, artist:artists!inner(id, slug, name, genre, biography, image_url, image_alt, social_links)')
      .eq('concert_id', concert.id).order('display_order').order('artist_id').abortSignal(signal),
    client.from('schedules')
      .select('id, artist_id, title, stage, description, starts_at, ends_at')
      .eq('concert_id', concert.id).eq('is_published', true)
      .order('starts_at').order('id').abortSignal(signal),
  ]);
  if (artistResult.error) throw artistResult.error;
  if (scheduleResult.error) throw scheduleResult.error;
  const schedules = scheduleResult.data ?? [];
  const artists = (artistResult.data ?? []).filter(row => row.artist).map(row => ({
    ...row.artist,
    billing: row.billing,
    is_featured: row.is_featured,
    performances: schedules.filter(slot => slot.artist_id === row.artist.id),
  }));
  const artistMap = new Map(artists.map(artist => [artist.id, artist]));
  return {
    concert,
    artists,
    schedules: schedules.map(slot => ({ ...slot, artist: artistMap.get(slot.artist_id) ?? null })),
  };
}
