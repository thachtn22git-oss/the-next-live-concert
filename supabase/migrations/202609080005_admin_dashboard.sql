begin;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- Profile column grants remain unchanged: browser clients cannot assign roles.
do $$ declare t text; begin
  foreach t in array array['concerts','artists','concert_artists','schedules','ticket_types','orders','order_items','tickets'] loop
    execute format('create policy "Admin read" on public.%I for select to authenticated using ((select public.is_admin()))', t);
  end loop;
  foreach t in array array['concerts','artists','concert_artists','schedules','ticket_types'] loop
    execute format('create policy "Admin update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
  foreach t in array array['artists','concert_artists','schedules'] loop
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "Admin insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "Admin delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;
grant update (name, description, venue, starts_at, ends_at, is_published) on public.concerts to authenticated;
grant update (name, description, price, total_quantity, max_per_order, sale_start, sale_end, is_active, display_order) on public.ticket_types to authenticated;

-- Removing a participant must not silently cascade-delete their schedule.
alter table public.schedules drop constraint schedules_concert_artist_fk;
alter table public.schedules add constraint schedules_concert_artist_fk
  foreign key (concert_id, artist_id) references public.concert_artists(concert_id, artist_id) on delete restrict;

alter table public.orders add column inventory_released_at timestamptz;
create index orders_admin_created_idx on public.orders(created_at desc, id);
create index orders_admin_status_idx on public.orders(status, payment_status, created_at desc, id);
create index tickets_admin_issued_idx on public.tickets(issued_at desc, id);

create function public.admin_confirm_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
  if not public.is_admin() then raise exception using errcode = 'TA001', message = 'ADMIN_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'TA002', message = 'ORDER_NOT_FOUND'; end if;
  if o.status = 'confirmed' and o.payment_status = 'paid' then
    return jsonb_build_object('order_id', o.id, 'status', o.status);
  end if;
  if o.status <> 'pending' or o.payment_status not in ('unpaid','failed') or o.inventory_released_at is not null then
    raise exception using errcode = 'TA003', message = 'INVALID_TRANSITION';
  end if;
  update public.orders set status = 'confirmed', payment_status = 'paid' where id = o.id;
  return jsonb_build_object('order_id', o.id, 'status', 'confirmed');
end $$;

create function public.admin_cancel_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; item record;
begin
  if not public.is_admin() then raise exception using errcode = 'TA001', message = 'ADMIN_REQUIRED'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'TA002', message = 'ORDER_NOT_FOUND'; end if;
  -- Historical cancellations predate our release marker: never guess whether they released stock.
  if o.status = 'cancelled' then return jsonb_build_object('order_id', o.id, 'status', 'cancelled'); end if;
  if o.payment_status = 'refunded' or o.inventory_released_at is not null then
    raise exception using errcode = 'TA003', message = 'INVALID_TRANSITION';
  end if;
  -- Check-in takes the same order lock first, so admission cannot race cancellation.
  if exists (select 1 from public.tickets where order_id = o.id and status = 'used') then
    raise exception using errcode = 'TA004', message = 'ORDER_HAS_USED_TICKETS';
  end if;
  for item in select t.id, t.sold_quantity, i.quantity from public.ticket_types t
    join public.order_items i on i.ticket_type_id = t.id where i.order_id = o.id order by t.id for update of t
  loop
    if item.sold_quantity < item.quantity then raise exception using errcode = 'TA005', message = 'INVENTORY_MISMATCH'; end if;
    update public.ticket_types set sold_quantity = sold_quantity - item.quantity where id = item.id;
  end loop;
  update public.orders set status = 'cancelled', inventory_released_at = now() where id = o.id;
  -- Existing lifecycle trigger cancels valid admissions. Payment history is preserved; no refund is executed.
  return jsonb_build_object('order_id', o.id, 'status', 'cancelled');
end $$;

create function public.admin_lookup_ticket(p_reference text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception using errcode = 'TA001', message = 'ADMIN_REQUIRED'; end if;
  select jsonb_build_object('ticket_code', t.ticket_code, 'ticket_name', t.ticket_name,
    'concert_name', t.concert_name, 'concert_starts_at', t.concert_starts_at, 'venue', t.venue,
    'used_at', t.used_at, 'status', case when o.status <> 'confirmed' or o.payment_status <> 'paid' then 'cancelled' else t.status end)
  into result from public.tickets t join public.orders o on o.id = t.order_id
  where t.ticket_code = upper(trim(p_reference)) or t.verification_token = case
    when trim(p_reference) ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then trim(p_reference)::uuid else null end;
  return result;
end $$;

create function public.check_in_ticket(p_reference text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.tickets%rowtype; o public.orders%rowtype; ticket_id uuid; order_id uuid;
begin
  if not public.is_admin() then raise exception using errcode = 'TA001', message = 'ADMIN_REQUIRED'; end if;
  select x.id, x.order_id into ticket_id, order_id from public.tickets x
    where x.ticket_code = upper(trim(p_reference)) or x.verification_token = case
      when trim(p_reference) ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then trim(p_reference)::uuid else null end;
  if ticket_id is null then raise exception using errcode = 'TA006', message = 'TICKET_NOT_FOUND'; end if;
  select * into o from public.orders where id = order_id for update;
  select * into t from public.tickets where id = ticket_id for update;
  if t.status = 'used' then raise exception using errcode = 'TA007', message = 'TICKET_ALREADY_USED'; end if;
  if t.status <> 'valid' or o.status <> 'confirmed' or o.payment_status <> 'paid' then
    raise exception using errcode = 'TA008', message = 'TICKET_CANCELLED';
  end if;
  update public.tickets set status = 'used', used_at = clock_timestamp() where id = t.id;
  return public.admin_lookup_ticket(t.ticket_code);
end $$;

create function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception using errcode = 'TA001', message = 'ADMIN_REQUIRED'; end if;
  return jsonb_build_object(
    'orders', (select count(*) from public.orders),
    'quantity', (select coalesce(sum(total_quantity),0) from public.orders where status <> 'cancelled'),
    'revenue', (select coalesce(sum(total_amount),0) from public.orders where status = 'confirmed' and payment_status = 'paid'),
    'pending', (select count(*) from public.orders where status = 'pending'),
    'issued', (select count(*) from public.tickets),
    'used', (select count(*) from public.tickets where status = 'used')
  );
end $$;

revoke all on function public.admin_confirm_order(uuid), public.admin_cancel_order(uuid), public.admin_lookup_ticket(text), public.check_in_ticket(text), public.admin_dashboard() from public, anon, authenticated;
grant execute on function public.admin_confirm_order(uuid), public.admin_cancel_order(uuid), public.admin_lookup_ticket(text), public.check_in_ticket(text), public.admin_dashboard() to authenticated;
commit;
