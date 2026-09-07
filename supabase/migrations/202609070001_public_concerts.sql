begin;

create table public.concerts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  venue text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_published boolean not null default false,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  constraint concert_time_range check (ends_at > starts_at)
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  genre text not null default '',
  biography text not null default '',
  image_url text,
  image_alt text not null default '',
  social_links jsonb not null default '{}'::jsonb
    check (jsonb_typeof(social_links) = 'object'),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.concert_artists (
  concert_id uuid not null references public.concerts(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  display_order integer not null default 0 check (display_order >= 0),
  billing text not null default 'Nghệ sĩ khách mời',
  is_featured boolean not null default false,
  primary key (concert_id, artist_id)
);
create index concert_artists_artist_idx on public.concert_artists(artist_id);
create index concert_artists_order_idx on public.concert_artists(concert_id, display_order);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.concerts(id) on delete cascade,
  artist_id uuid,
  title text not null check (length(trim(title)) > 0),
  stage text not null default '',
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint schedule_time_range check (ends_at > starts_at),
  -- An artist can only perform at a concert they belong to. Non-artist slots are allowed.
  constraint schedules_concert_artist_fk foreign key (concert_id, artist_id)
    references public.concert_artists(concert_id, artist_id) on delete cascade
);
create index schedules_concert_time_idx on public.schedules(concert_id, starts_at, id);
create index schedules_artist_idx on public.schedules(artist_id);

alter table public.concerts enable row level security;
alter table public.artists enable row level security;
alter table public.concert_artists enable row level security;
alter table public.schedules enable row level security;

-- Browser keys only receive SELECT. There are no public mutation policies.
revoke all on public.concerts, public.artists, public.concert_artists, public.schedules
  from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.concerts, public.artists, public.concert_artists, public.schedules
  to anon, authenticated;

create policy "Read published concerts" on public.concerts
  for select to anon, authenticated using (is_published);
create policy "Read published artists" on public.artists
  for select to anon, authenticated using (is_published);
create policy "Read published concert artists" on public.concert_artists
  for select to anon, authenticated using (
    exists (select 1 from public.concerts c where c.id = concert_id and c.is_published)
    and exists (select 1 from public.artists a where a.id = artist_id and a.is_published)
  );
create policy "Read published schedules" on public.schedules
  for select to anon, authenticated using (
    is_published
    and exists (select 1 from public.concerts c where c.id = concert_id and c.is_published)
    and (artist_id is null or exists (
      select 1 from public.artists a where a.id = artist_id and a.is_published
    ))
  );

commit;
