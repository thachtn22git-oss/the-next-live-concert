begin;

-- Run seed.sql first if the development concert does not already exist.
do $$
begin
  if not exists (select 1 from public.concerts where slug = 'the-next-live-concert-2026') then
    raise exception 'Create the-next-live-concert-2026 (seed.sql) before seeding ticket types.';
  end if;
end;
$$;

-- No sale boundaries for development: these sample passes can be selected immediately.
-- Re-running never resets inventory, prices or later editorial changes.
insert into public.ticket_types (
  concert_id, name, slug, description, price, total_quantity, max_per_order, display_order
)
select c.id, seed.name, seed.slug, seed.description, seed.price, seed.quantity, seed.maximum, seed.position
from public.concerts c
cross join (values
  ('STANDARD', 'standard', E'Khu vực tiêu chuẩn\nTrải nghiệm toàn bộ chương trình', 499000, 1000, 6, 1),
  ('VIP', 'vip', E'Khu vực VIP\nLối vào ưu tiên\nQuà tặng sự kiện', 899000, 500, 4, 2),
  ('PREMIUM', 'premium', E'Khu vực gần sân khấu\nLối vào ưu tiên\nBộ quà tặng đặc biệt', 1499000, 150, 2, 3)
) as seed(name, slug, description, price, quantity, maximum, position)
where c.slug = 'the-next-live-concert-2026'
on conflict (concert_id, slug) do nothing;

commit;
