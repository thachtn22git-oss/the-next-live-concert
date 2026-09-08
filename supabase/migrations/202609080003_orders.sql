begin;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  concert_id uuid not null references public.concerts(id) on delete restrict,
  request_id uuid not null,
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 120),
  customer_email text not null check (char_length(customer_email) <= 254 and customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  customer_phone text not null check (customer_phone ~ '^\+?[0-9]{9,15}$'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'failed', 'refunded')),
  total_quantity integer not null check (total_quantity > 0),
  total_amount bigint not null check (total_amount between 0 and 9007199254740991),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_concert_idx on public.orders(concert_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  ticket_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  subtotal bigint not null check (subtotal >= 0 and subtotal = quantity::bigint * unit_price),
  created_at timestamptz not null default now(),
  unique (order_id, ticket_type_id)
);
create index order_items_ticket_idx on public.order_items(ticket_type_id);

create function public.touch_order_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.touch_order_updated_at() from public, anon, authenticated;
create trigger touch_order_before_update before update on public.orders
  for each row execute function public.touch_order_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.orders, public.order_items from public, anon, authenticated;
grant select on public.orders, public.order_items to authenticated;
create policy "Read own orders" on public.orders for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Read own order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));

create function public.create_order(
  p_concert_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_items jsonb,
  p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_order_code text;
  v_name text := trim(p_customer_name);
  v_email text := lower(trim(p_customer_email));
  v_phone text := regexp_replace(p_customer_phone, '[[:space:]().-]', '', 'g');
  v_item jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_quantities integer[] := '{}';
  v_ticket public.ticket_types%rowtype;
  v_quantity integer;
  v_seen integer := 0;
  v_total_quantity bigint := 0;
  v_total_amount numeric := 0;
  v_snapshots jsonb := '[]';
  v_time timestamptz;
begin
  if v_user_id is null then raise exception using errcode = 'TN001', message = 'AUTH_REQUIRED'; end if;
  if p_request_id is null then raise exception using errcode = 'TN002', message = 'INVALID_SELECTION'; end if;

  -- Concurrent retries of the same user's request serialize before checking existence.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_request_id::text, 0));
  select id, order_code into v_order_id, v_order_code from public.orders
    where user_id = v_user_id and request_id = p_request_id;
  if found then return jsonb_build_object('order_id', v_order_id, 'order_code', v_order_code); end if;

  if v_name is null or char_length(v_name) not between 1 and 120
    or v_email is null or char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or v_phone is null or v_phone !~ '^\+?[0-9]{9,15}$'
  then raise exception using errcode = 'TN010', message = 'INVALID_CUSTOMER'; end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = 'TN002', message = 'INVALID_SELECTION';
  end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception using errcode = 'TN002', message = 'INVALID_SELECTION';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_item -> 'ticket_type_id') is distinct from 'string'
      or jsonb_typeof(v_item -> 'quantity') is distinct from 'number'
    then raise exception using errcode = 'TN002', message = 'INVALID_SELECTION'; end if;
    if v_item - 'ticket_type_id' - 'quantity' <> '{}'::jsonb
      or (v_item ->> 'quantity') !~ '^[1-9][0-9]{0,9}$'
    then raise exception using errcode = 'TN002', message = 'INVALID_SELECTION'; end if;
    if (v_item ->> 'quantity')::numeric > 2147483647 then
      raise exception using errcode = 'TN002', message = 'INVALID_SELECTION';
    end if;
    begin
      v_id := (v_item ->> 'ticket_type_id')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = 'TN002', message = 'INVALID_SELECTION';
    end;
    if v_id = any(v_ids) then raise exception using errcode = 'TN002', message = 'INVALID_SELECTION'; end if;
    v_ids := array_append(v_ids, v_id);
    v_quantities := array_append(v_quantities, (v_item ->> 'quantity')::integer);
  end loop;

  -- A concurrent editor cannot unpublish/delete this concert before we commit.
  perform 1 from public.concerts where id = p_concert_id and is_published for share;
  if not found then raise exception using errcode = 'TN003', message = 'CONCERT_UNAVAILABLE'; end if;

  -- All calls acquire inventory locks in UUID order, independent of input order.
  for v_ticket in
    select * from public.ticket_types where id = any(v_ids) order by id for update
  loop
    v_seen := v_seen + 1;
    v_quantity := v_quantities[array_position(v_ids, v_ticket.id)];
    if v_ticket.concert_id <> p_concert_id or not v_ticket.is_active then
      raise exception using errcode = 'TN004', message = 'TICKET_UNAVAILABLE';
    end if;
    -- Use wall-clock time after waiting for locks, not transaction-start time.
    v_time := clock_timestamp();
    if v_ticket.sale_start is not null and v_time < v_ticket.sale_start then
      raise exception using errcode = 'TN005', message = 'SALE_NOT_STARTED';
    end if;
    if v_ticket.sale_end is not null and v_time >= v_ticket.sale_end then
      raise exception using errcode = 'TN006', message = 'SALE_ENDED';
    end if;
    if v_quantity > v_ticket.max_per_order then
      raise exception using errcode = 'TN007', message = 'ORDER_LIMIT_EXCEEDED';
    end if;
    if v_ticket.total_quantity - v_ticket.sold_quantity = 0 then
      raise exception using errcode = 'TN008', message = 'SOLD_OUT';
    end if;
    if v_quantity > v_ticket.total_quantity - v_ticket.sold_quantity then
      raise exception using errcode = 'TN009', message = 'INVENTORY_CHANGED';
    end if;
    v_total_quantity := v_total_quantity + v_quantity;
    v_total_amount := v_total_amount + v_quantity::bigint * v_ticket.price;
    if v_total_quantity > 2147483647 or v_total_amount > 9007199254740991 then
      raise exception using errcode = 'TN002', message = 'INVALID_SELECTION';
    end if;
    v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
      'ticket_type_id', v_ticket.id, 'ticket_name', v_ticket.name,
      'quantity', v_quantity, 'unit_price', v_ticket.price,
      'subtotal', v_quantity::bigint * v_ticket.price
    ));
  end loop;
  if v_seen <> cardinality(v_ids) then raise exception using errcode = 'TN002', message = 'INVALID_SELECTION'; end if;

  -- Recheck every sale end after all locks have been acquired.
  if exists (select 1 from public.ticket_types where id = any(v_ids) and sale_end <= clock_timestamp()) then
    raise exception using errcode = 'TN006', message = 'SALE_ENDED';
  end if;

  v_order_id := gen_random_uuid();
  v_order_code := 'TNL-' || to_char(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD')
    || '-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 20));
  insert into public.orders (
    id, order_code, user_id, concert_id, request_id, customer_name, customer_email,
    customer_phone, status, payment_status, total_quantity, total_amount
  ) values (
    v_order_id, v_order_code, v_user_id, p_concert_id, p_request_id, v_name, v_email,
    v_phone, 'pending', 'unpaid', v_total_quantity::integer, v_total_amount::bigint
  );
  insert into public.order_items(order_id, ticket_type_id, ticket_name, quantity, unit_price, subtotal)
    select v_order_id, x.ticket_type_id, x.ticket_name, x.quantity, x.unit_price, x.subtotal
    from jsonb_to_recordset(v_snapshots) as x(ticket_type_id uuid, ticket_name text, quantity integer, unit_price integer, subtotal bigint);
  update public.ticket_types t
    set sold_quantity = t.sold_quantity + x.quantity
    from jsonb_to_recordset(v_snapshots) as x(ticket_type_id uuid, quantity integer)
    where t.id = x.ticket_type_id;

  return jsonb_build_object('order_id', v_order_id, 'order_code', v_order_code);
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, jsonb, uuid) to authenticated;
comment on function public.create_order(uuid, text, text, text, jsonb, uuid) is
  'Creates pending/unpaid orders atomically. auth.uid owns the order. Ticket rows are locked in UUID order; prices are read from the DB. request_id is idempotent per user.';
comment on column public.ticket_types.sold_quantity is
  'Includes pending/unpaid Phase 5 orders. Only trusted transactional order logic may increment this field; no browser UPDATE grants.';

commit;
