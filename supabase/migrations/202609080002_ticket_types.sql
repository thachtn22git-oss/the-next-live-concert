begin;

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references public.concerts(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  price integer not null check (price >= 0),
  total_quantity integer not null check (total_quantity >= 0),
  sold_quantity integer not null default 0 check (sold_quantity >= 0),
  max_per_order integer not null default 4 check (max_per_order > 0),
  sale_start timestamptz,
  sale_end timestamptz,
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_types_concert_slug_unique unique (concert_id, slug),
  constraint ticket_types_inventory_valid check (sold_quantity <= total_quantity),
  constraint ticket_types_sale_window_valid check (
    sale_start is null or sale_end is null or sale_end > sale_start
  )
);

create index ticket_types_public_order_idx
  on public.ticket_types(concert_id, display_order, id) where is_active;

create function public.touch_ticket_type_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.touch_ticket_type_updated_at() from public, anon, authenticated;
create trigger touch_ticket_type_before_update
  before update on public.ticket_types
  for each row execute function public.touch_ticket_type_updated_at();

alter table public.ticket_types enable row level security;
revoke all on public.ticket_types from public, anon, authenticated;
grant select on public.ticket_types to anon, authenticated;
create policy "Read active tickets for published concerts" on public.ticket_types
  for select to anon, authenticated using (
    is_active and exists (
      select 1 from public.concerts c where c.id = concert_id and c.is_published
    )
  );

comment on column public.ticket_types.sold_quantity is
  'Phase 4 is read-only selection. Phase 5 must revalidate price, sale windows and inventory and reserve/decrement atomically on the server.';

commit;
