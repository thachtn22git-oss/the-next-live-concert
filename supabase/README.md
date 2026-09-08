# Phase 2: Public concert data

For registration, login, private profiles and password recovery, continue with [Phase 3 authentication setup](AUTH.md).

For ticket types and client-side selection, see [Phase 4 ticket setup](TICKETS.md).

## Configure a hosted Supabase project

1. Create a Supabase project, then open its SQL Editor.
2. Run [migrations/202609070001_public_concerts.sql](migrations/202609070001_public_concerts.sql) once. It creates all four tables, indexes, constraints, grants and row-level security policies in one transaction.
3. Optionally run [seed.sql](seed.sql). It inserts one concert, five fictional artists, five concert/artist relationships and seven schedule slots. It can be rerun without duplicating or overwriting these rows. Use a development project for sample content.
4. In the project connection settings, obtain the project URL and a public publishable key (or legacy anon key). Never use a secret or service-role key in Vite.
5. Create a local `.env.local` using the keys in the root `.env.example`:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
   VITE_CONCERT_SLUG=the-next-live-concert-2026
   ```

6. Restart `npm run dev`. For deployment, set the same variables in the build environment and rebuild. Configure the host to rewrite frontend routes to `index.html`.
7. Open `/`, `/artists`, `/artists/an-nhien`, and `/schedule`. The two home previews and all three pages read the same concert program.

The variable name `VITE_SUPABASE_ANON_KEY` is retained for compatibility; a current publishable key also works. All Vite variables are public browser configuration.

## Data model and publishing

- `concerts`: unique slug, event name, venue, start/end timestamps, publication flag and sample-data flag.
- `artists`: unique slug, name, genre, biography, image URL, image alt text, social links and publication flag.
- `concert_artists`: composite concert/artist key, display order, billing label and featured flag.
- `schedules`: concert, optional artist, title, stage, description, start/end timestamps and publication flag. An assigned artist must belong to the same concert.

Use the Supabase Table Editor or trusted SQL to edit content. No administration UI is implemented.

Publish a concert and its artists with `is_published = true`, add their `concert_artists` rows, then publish the schedules. Unpublished concerts hide their relationships and schedules. Unpublished artists hide their relationships and associated schedules. Published artist profiles themselves remain publicly readable independently of concert publication. Anonymous and authenticated browser roles have SELECT only; no public writes are allowed.

Set `concerts.is_sample = false` only after replacing the fictional data with confirmed content. Sample portraits are external illustration URLs, not photos of the fictional artists. Social links start empty to avoid implying official profiles. Supported keys:

```json
{
  "instagram": "https://www.instagram.com/YOUR_HANDLE/",
  "facebook": "https://www.facebook.com/YOUR_PAGE/",
  "youtube": "https://www.youtube.com/@YOUR_CHANNEL",
  "tiktok": "https://www.tiktok.com/@YOUR_HANDLE",
  "spotify": "https://open.spotify.com/artist/YOUR_ARTIST_ID",
  "website": "https://YOUR_WEBSITE"
}
```

Only valid HTTP(S) links are displayed. Use Vietnamese text for content fields. PostgreSQL stores timestamps as `timestamptz`; the UI always formats them in `Asia/Ho_Chi_Minh` (UTC+7). Hero, countdown, ticket and venue content remain as designed in Phase 1; Phase 2 connects only artist and schedule content.

## States and troubleshooting

- No configuration, unavailable network, query failure or a 15-second timeout: Vietnamese error state with retry.
- Missing/unpublished concert or empty collections: Vietnamese empty state.
- Unknown artist slug: an explicit not-found message with a link back to the artist list.
- Missing or failed artist image: an accessible text fallback in the existing image space.
- Data is loaded once per mounted layout and shared across public routes. Retry reloads the shared dataset. Refresh the page to see subsequent database edits.

If pages are empty, check the configured slug, publication flags and concert/artist relationships. If they show an error, check URL/key values, migration installation and network access. Database error details and configuration values are not exposed in the public UI.

## Verification

```sh
npm test
npm run lint
npm run build
```

Tests use the installed Supabase client with mocked HTTP responses for query behavior, plus PGlite (PostgreSQL compiled to WebAssembly) for executing the real migration and seed, checking integrity constraints and public permissions. PGlite is a development-only dependency and does not enter the frontend bundle. No live project is modified by these tests.

Official references: [Supabase public data security](https://supabase.com/docs/guides/database/secure-data), [RLS policies](https://supabase.com/docs/guides/database/postgres/row-level-security), [JavaScript selects](https://supabase.com/docs/reference/javascript/select).
