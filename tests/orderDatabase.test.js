import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const owner = '60000000-0000-4000-8000-000000000001';
const other = '60000000-0000-4000-8000-000000000002';
const rpc = 'select public.create_order($1, $2, $3, $4, $5::jsonb, $6) as result';
const customer = ['Nguyễn An', 'an@example.com', '0901234567'];

test('atomic order RPC: validation, prices, snapshots, rollback, idempotency and private access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    await db.query('insert into auth.users values ($1), ($2)', [owner, other]);
    for (const file of ['migrations/202609070001_public_concerts.sql', 'seed.sql', 'migrations/202609080002_ticket_types.sql', 'seed_tickets.sql', 'migrations/202609080003_orders.sql']) {
      await db.exec(await readFile(new URL('../supabase/' + file, import.meta.url), 'utf8'));
    }
    const types = (await db.query('select * from public.ticket_types order by display_order')).rows;
    const concert = types[0].concert_id;
    const items = [{ ticket_type_id: types[0].id, quantity: 2 }, { ticket_type_id: types[1].id, quantity: 1 }];
    const requestId = globalThis.crypto.randomUUID();
    const args = [concert, ...customer, JSON.stringify(items), requestId];
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    await db.exec('set role authenticated');
    const result = (await db.query(rpc, args)).rows[0].result;
    assert.match(result.order_code, /^TNL-\d{8}-[0-9A-F]{20}$/);
    const order = (await db.query('select * from public.orders')).rows[0];
    assert.equal(order.user_id, owner);
    assert.equal(order.status, 'pending');
    assert.equal(order.payment_status, 'unpaid');
    assert.equal(order.total_quantity, 3);
    assert.equal(Number(order.total_amount), 1897000);
    assert.equal((await db.query('select * from public.order_items')).rows.length, 2);
    assert.deepEqual((await db.query(rpc, args)).rows[0].result, result, 'idempotent retry returns same order');
    assert.equal((await db.query('select * from public.orders')).rows.length, 1);
    await db.exec('reset role');
    const sold = (await db.query('select sold_quantity from public.ticket_types order by display_order')).rows;
    assert.deepEqual(sold.map(row => row.sold_quantity), [2, 1, 0]);

    const rejectCase = async (code, selected = items, setup, overrides = {}) => {
      await db.exec('begin');
      if (setup) await setup();
      await db.exec('set local role authenticated');
      const input = [overrides.concert || concert, ...(overrides.customer || customer), JSON.stringify(selected), globalThis.crypto.randomUUID()];
      await assert.rejects(db.query(rpc, input), error => error.code === code);
      await db.exec('rollback');
      assert.equal((await db.query('select * from public.orders')).rows.length, 1);
      assert.deepEqual((await db.query('select sold_quantity from public.ticket_types order by display_order')).rows, sold);
    };
    await rejectCase('TN009', items, () => db.query('update public.ticket_types set sold_quantity = total_quantity - 1 where id = $1', [types[0].id]));
    await rejectCase('TN008', items, () => db.query('update public.ticket_types set sold_quantity = total_quantity where id = $1', [types[1].id]));
    await rejectCase('TN007', [{ ticket_type_id: types[0].id, quantity: 7 }]);
    await rejectCase('TN004', items, () => db.query('update public.ticket_types set is_active = false where id = $1', [types[1].id]));
    await rejectCase('TN004', items, async () => {
      await db.exec("insert into public.concerts(id, slug, name, starts_at, ends_at, is_published) values ('10000000-0000-4000-8000-000000000099', 'other', 'Other', now(), now() + interval '1 day', true)");
      await db.exec("update public.ticket_types set concert_id = '10000000-0000-4000-8000-000000000099'");
    });
    await rejectCase('TN003', items, () => db.exec('update public.concerts set is_published = false'));
    await rejectCase('TN005', items, () => db.exec("update public.ticket_types set sale_start = clock_timestamp() + interval '1 day'"));
    await rejectCase('TN006', items, () => db.exec("update public.ticket_types set sale_end = clock_timestamp() - interval '1 second'"));
    await rejectCase('TN010', items, null, { customer: ['', 'invalid', 'abc'] });
    for (const invalid of [[], {}, null, [{ ...items[0], quantity: 0 }], [{ ...items[0], quantity: -1 }], [{ ...items[0], quantity: 1.5 }], [items[0], items[0]], [{ ...items[0], unit_price: 1 }], [{ ...items[0], ticket_type_id: 'invalid' }], [{ ...items[0], ticket_type_id: '99999999-0000-4000-8000-000000000001' }]]) {
      await rejectCase('TN002', invalid);
    }
    // Simulate a late failure after items were inserted: the entire RPC still rolls back.
    await db.exec(`create function public.reject_inventory_test() returns trigger language plpgsql as $$ begin raise exception 'test inventory failure'; end; $$;
      create trigger reject_inventory_test before update on public.ticket_types for each row execute function public.reject_inventory_test();`);
    await db.exec('set role authenticated');
    await assert.rejects(db.query(rpc, [concert, ...customer, JSON.stringify(items), globalThis.crypto.randomUUID()]), /test inventory failure/);
    await db.exec('reset role');
    assert.equal((await db.query('select * from public.orders')).rows.length, 1);
    assert.equal((await db.query('select * from public.order_items')).rows.length, 2);
    await db.exec('drop trigger reject_inventory_test on public.ticket_types; drop function public.reject_inventory_test();');

    // Database price changes override stale UI prices; existing snapshots stay unchanged.
    await db.query('update public.ticket_types set price = 600000, total_quantity = sold_quantity + 1 where id = $1', [types[0].id]);
    await db.exec('set role authenticated');
    await db.query(rpc, [concert, ...customer, JSON.stringify([{ ticket_type_id: types[0].id, quantity: 1 }]), globalThis.crypto.randomUUID()]);
    const totals = (await db.query('select total_amount from public.orders order by created_at')).rows;
    assert.deepEqual(totals.map(row => Number(row.total_amount)), [1897000, 600000]);
    await assert.rejects(db.query(rpc, [concert, ...customer, JSON.stringify([{ ticket_type_id: types[0].id, quantity: 1 }]), globalThis.crypto.randomUUID()]), error => error.code === 'TN008');
    for (const table of ['orders', 'order_items']) {
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        assert.equal((await db.query('select has_table_privilege(current_user, $1, $2) as allowed', ['public.' + table, privilege])).rows[0].allowed, false);
      }
    }
    await assert.rejects(db.exec("update public.orders set payment_status = 'paid'"), /permission denied/);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.orders')).rows.length, 0);
    assert.equal((await db.query('select * from public.order_items')).rows.length, 0);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await db.exec('set role authenticated');
    await assert.rejects(db.query(rpc, args), error => error.code === 'TN001');
    await db.exec('reset role');
    await db.exec('set role anon');
    await assert.rejects(db.query(rpc, args), /permission denied/);
    await assert.rejects(db.exec('select * from public.orders'), /permission denied/);
  } finally { await db.close(); }
});
