begin;

alter table public.orders add column expires_at timestamptz;
alter table public.orders add column expired_at timestamptz;

-- A BEFORE INSERT trigger also covers create_order without copying its secure implementation.
create function public.set_order_expiration() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.expires_at := case when new.status = 'pending' and new.payment_status = 'unpaid'
    then new.created_at + interval '15 minutes' else null end;
  new.expired_at := null;
  return new;
end $$;
revoke all on function public.set_order_expiration() from public, anon, authenticated;
create trigger set_order_expiration before insert on public.orders
  for each row execute function public.set_order_expiration();

update public.orders set expires_at = created_at + interval '15 minutes'
where status = 'pending' and payment_status = 'unpaid' and expires_at is null;
create index orders_expiration_idx on public.orders(expires_at, id)
  where status = 'pending' and payment_status = 'unpaid' and inventory_released_at is null;

-- Internal only: callers must provide their own authorization before invoking this helper.
create function public.cancel_order_and_release(p_order_id uuid, p_expired boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; item record;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'TA002', message = 'ORDER_NOT_FOUND'; end if;
  if o.status = 'cancelled' then return jsonb_build_object('order_id', o.id, 'status', 'cancelled'); end if;
  if p_expired and (o.status <> 'pending' or o.payment_status <> 'unpaid'
    or o.expires_at is null or o.expires_at > clock_timestamp()) then
    raise exception using errcode = 'TA003', message = 'NOT_EXPIRED';
  end if;
  if o.payment_status = 'refunded' or o.inventory_released_at is not null then
    raise exception using errcode = 'TA003', message = 'INVALID_TRANSITION';
  end if;
  if exists (select 1 from public.tickets where order_id = o.id and status = 'used') then
    raise exception using errcode = 'TA004', message = 'ORDER_HAS_USED_TICKETS';
  end if;
  if (select coalesce(sum(quantity),0) from public.order_items where order_id = o.id) <> o.total_quantity then
    raise exception using errcode = 'TA005', message = 'INVENTORY_MISMATCH';
  end if;
  for item in select t.id, t.sold_quantity, i.quantity from public.ticket_types t
    join public.order_items i on i.ticket_type_id = t.id where i.order_id = o.id order by t.id for update of t
  loop
    if item.sold_quantity < item.quantity then raise exception using errcode = 'TA005', message = 'INVENTORY_MISMATCH'; end if;
    update public.ticket_types set sold_quantity = sold_quantity - item.quantity where id = item.id;
  end loop;
  update public.orders set status = 'cancelled', inventory_released_at = clock_timestamp(),
    expired_at = case when p_expired then clock_timestamp() else null end where id = o.id;
  return jsonb_build_object('order_id', o.id, 'status', 'cancelled');
end $$;
revoke all on function public.cancel_order_and_release(uuid, boolean) from public, anon, authenticated;

create or replace function public.admin_cancel_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception using errcode = 'TA001', message = 'ADMIN_REQUIRED'; end if;
  return public.cancel_order_and_release(p_order_id, false);
end $$;

create or replace function public.admin_confirm_order(p_order_id uuid) returns jsonb
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
  -- Match creation/expiration lock order before the issuance trigger reads inventory.
  perform 1 from public.concerts where id = o.concert_id for share;
  perform 1 from public.ticket_types t where t.id in (
    select i.ticket_type_id from public.order_items i where i.order_id = o.id
  ) order by t.id for share;
  update public.orders set status = 'confirmed', payment_status = 'paid' where id = o.id;
  return jsonb_build_object('order_id', o.id, 'status', 'confirmed');
end $$;

-- Bounded atomic batches. No customer execution privilege, no client timestamps or order IDs.
create function public.expire_pending_orders() returns integer
language plpgsql security definer set search_path = '' as $$
declare ids uuid[]; order_id uuid; processed integer := 0;
begin
  -- Lock every candidate order before any inventory; SKIP LOCKED lets confirmation win cleanly.
  select array_agg(candidate.id) into ids from (
    select o.id from public.orders o
    where o.status = 'pending' and o.payment_status = 'unpaid'
      and o.expires_at <= clock_timestamp() and o.inventory_released_at is null
      and not exists (select 1 from public.tickets t where t.order_id = o.id and t.status = 'used')
    order by o.expires_at, o.id limit 100 for update of o skip locked
  ) candidate;
  if ids is null then return 0; end if;
  -- One global inventory lock order for the entire batch prevents cross-order lock inversion.
  perform 1 from public.ticket_types t where t.id in (
    select i.ticket_type_id from public.order_items i where i.order_id = any(ids)
  ) order by t.id for update;
  foreach order_id in array ids loop
    perform public.cancel_order_and_release(order_id, true);
    processed := processed + 1;
  end loop;
  return processed;
end $$;
revoke all on function public.expire_pending_orders() from public, anon, authenticated;

create function public.admin_expire_pending_orders() returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception using errcode = 'TA001', message = 'ADMIN_REQUIRED'; end if;
  return public.expire_pending_orders();
end $$;
revoke all on function public.admin_expire_pending_orders() from public, anon, authenticated;
grant execute on function public.admin_expire_pending_orders() to authenticated;

comment on column public.orders.expires_at is 'Server-assigned created_at + 15 minutes for pending/unpaid orders. Informational deadline until the expiration worker commits cancellation.';
comment on column public.orders.expired_at is 'Set only when the expiration worker cancels and releases inventory; null for manual cancellations.';
comment on function public.expire_pending_orders() is 'Trusted scheduler/SQL only. Atomically cancels up to 100 eligible orders and releases each reservation once. Run every minute; monitor failures/backlog.';
commit;
