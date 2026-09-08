begin;

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique,
  verification_token uuid not null unique default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  concert_id uuid not null references public.concerts(id) on delete restrict,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  ticket_name text not null,
  admission_number integer not null check (admission_number > 0),
  concert_name text not null,
  concert_starts_at timestamptz not null,
  venue text,
  status text not null default 'valid' check (status in ('valid', 'used', 'cancelled')),
  issued_at timestamptz not null default now(),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_item_id, admission_number),
  check ((status = 'used' and used_at is not null) or (status <> 'used' and used_at is null))
);
create index tickets_user_issued_idx on public.tickets(user_id, issued_at desc, id);
create index tickets_order_idx on public.tickets(order_id);
create index tickets_concert_idx on public.tickets(concert_id);
create index tickets_type_idx on public.tickets(ticket_type_id);

alter table public.tickets enable row level security;
revoke all on public.tickets from public, anon, authenticated;
grant select on public.tickets to authenticated;
create policy "Read own digital tickets" on public.tickets for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.issue_tickets_for_order(p_order_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_concert public.concerts%rowtype;
  v_item public.order_items%rowtype;
  v_count bigint;
begin
  -- All issuance attempts for this order serialize, including trigger/manual retries.
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'confirmed' or v_order.payment_status <> 'paid' then
    raise exception 'ORDER_NOT_ELIGIBLE';
  end if;
  perform 1 from auth.users where id = v_order.user_id;
  if not found then raise exception 'ORDER_OWNER_NOT_FOUND'; end if;
  select * into strict v_concert from public.concerts where id = v_order.concert_id for share;
  perform 1 from public.order_items where order_id = p_order_id order by id for share;
  select coalesce(sum(quantity), 0) into v_count from public.order_items where order_id = p_order_id;
  if v_count <> v_order.total_quantity or v_count = 0 then raise exception 'ORDER_ITEMS_MISMATCH'; end if;

  for v_item in select * from public.order_items where order_id = p_order_id order by id loop
    perform 1 from public.ticket_types where id = v_item.ticket_type_id and concert_id = v_order.concert_id for share;
    if not found then raise exception 'TICKET_CONCERT_MISMATCH'; end if;
    -- Stable ordinal + unique constraint means a retry never replaces tokens or statuses.
    insert into public.tickets (
      ticket_code, order_id, order_item_id, user_id, concert_id, ticket_type_id,
      ticket_name, admission_number, concert_name, concert_starts_at, venue
    ) select
      'TNL-TKT-' || upper(replace(gen_random_uuid()::text, '-', '')),
      v_order.id, v_item.id, v_order.user_id, v_order.concert_id, v_item.ticket_type_id,
      v_item.ticket_name, n, v_concert.name, v_concert.starts_at, v_concert.venue
    from generate_series(1, v_item.quantity) as n
    on conflict (order_item_id, admission_number) do nothing;
  end loop;
  select count(*) into v_count from public.tickets where order_id = p_order_id;
  if v_count <> v_order.total_quantity then raise exception 'ISSUED_QUANTITY_MISMATCH'; end if;
  return v_count::integer;
end;
$$;
revoke all on function public.issue_tickets_for_order(uuid) from public, anon, authenticated;

create function public.sync_order_digital_tickets()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'confirmed' and new.payment_status = 'paid' then
    perform public.issue_tickets_for_order(new.id);
  else
    -- Leaving eligibility revokes unused admissions. Retrying issuance never revives them.
    update public.tickets set status = 'cancelled' where order_id = new.id and status = 'valid';
  end if;
  return new;
end;
$$;
revoke all on function public.sync_order_digital_tickets() from public, anon, authenticated;
create trigger sync_order_digital_tickets
  after update of status, payment_status on public.orders
  for each row execute function public.sync_order_digital_tickets();

create function public.verify_ticket(p_token uuid)
returns table (
  is_valid boolean, ticket_code text, ticket_name text, concert_name text,
  concert_starts_at timestamptz, venue text, status text
)
language sql stable security definer set search_path = '' as $$
  select
    t.status = 'valid' and o.status = 'confirmed' and o.payment_status = 'paid',
    t.ticket_code, t.ticket_name, t.concert_name, t.concert_starts_at, t.venue,
    case when o.status <> 'confirmed' or o.payment_status <> 'paid' then 'cancelled' else t.status end
  from public.tickets t join public.orders o on o.id = t.order_id
  where t.verification_token = p_token;
$$;
revoke all on function public.verify_ticket(uuid) from public, anon, authenticated;
grant execute on function public.verify_ticket(uuid) to anon, authenticated;

-- Existing eligible orders are issued atomically with this migration. Any mismatch rolls it back.
do $$
declare v_id uuid;
begin
  for v_id in select id from public.orders where status = 'confirmed' and payment_status = 'paid' order by id loop
    perform public.issue_tickets_for_order(v_id);
  end loop;
end;
$$;

comment on table public.tickets is 'One admission per purchased unit. Only trusted backend issuance writes tickets. Concert details are issuance snapshots.';
comment on column public.tickets.verification_token is 'Bearer verification token: no customer data. Do not log or send to external QR services.';
comment on function public.verify_ticket(uuid) is 'Read-only public verification. No personal data and never marks a ticket used.';

commit;
