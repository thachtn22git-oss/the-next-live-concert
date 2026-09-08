import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('ticket SQL, idempotent seed, inventory constraints, publication rules and read-only grants', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated;');
    for (const file of ['migrations/202609070001_public_concerts.sql', 'seed.sql', 'migrations/202609080002_ticket_types.sql', 'seed_tickets.sql', 'seed_tickets.sql']) {
      await db.exec(await readFile(new URL('../supabase/' + file, import.meta.url), 'utf8'));
    }
    const seeded = (await db.query('select name, price, total_quantity, max_per_order from public.ticket_types order by display_order')).rows;
    assert.deepEqual(seeded, [
      { name: 'STANDARD', price: 499000, total_quantity: 1000, max_per_order: 6 },
      { name: 'VIP', price: 899000, total_quantity: 500, max_per_order: 4 },
      { name: 'PREMIUM', price: 1499000, total_quantity: 150, max_per_order: 2 },
    ]);
    for (const assignment of ['price = -1', 'total_quantity = -1', 'sold_quantity = -1', 'sold_quantity = total_quantity + 1', 'max_per_order = 0', "sale_start = '2026-10-01', sale_end = '2026-09-01'"]) {
      await assert.rejects(db.exec('update public.ticket_types set ' + assignment), /check constraint/);
    }
    await assert.rejects(db.exec("update public.ticket_types set slug = 'standard' where slug = 'vip'"), /unique constraint/);
    await db.exec("update public.ticket_types set sold_quantity = 3 where slug = 'vip'");
    await db.exec(await readFile(new URL('../supabase/seed_tickets.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query("select sold_quantity from public.ticket_types where slug = 'vip'")).rows[0].sold_quantity, 3);
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      assert.equal((await db.query('select * from public.ticket_types')).rows.length, 3);
      for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        const result = await db.query("select has_table_privilege(current_user, 'public.ticket_types', $1) as allowed", [privilege]);
        assert.equal(result.rows[0].allowed, false);
      }
      await assert.rejects(db.exec('update public.ticket_types set sold_quantity = sold_quantity + 1'), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec("update public.ticket_types set is_active = false where slug = 'premium'");
    await db.exec('set role anon');
    assert.equal((await db.query('select * from public.ticket_types')).rows.length, 2);
    await db.exec('reset role');
    await db.exec('update public.concerts set is_published = false');
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.ticket_types')).rows.length, 0);
    await db.exec('reset role');
    await db.exec('delete from public.concerts');
    assert.equal((await db.query('select * from public.ticket_types')).rows.length, 0);
  } finally { await db.close(); }
});
