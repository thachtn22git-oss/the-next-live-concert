import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const owner = '60000000-0000-4000-8000-000000000001';
const other = '60000000-0000-4000-8000-000000000002';

test('digital ticket migration: eligibility, backfill, per-unit issuance, idempotency, RLS and safe read-only verification', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    await db.query('insert into auth.users values ($1), ($2)', [owner, other]);
    for (const file of ['migrations/202609070001_public_concerts.sql', 'seed.sql', 'migrations/202609080002_ticket_types.sql', 'seed_tickets.sql', 'migrations/202609080003_orders.sql']) {
      await db.exec(await readFile(new URL('../supabase/' + file, import.meta.url), 'utf8'));
    }
    const types = (await db.query('select * from public.ticket_types order by display_order')).rows;
    const makeOrder = async quantities => {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
      return (await db.query('select public.create_order($1,$2,$3,$4,$5::jsonb,$6) as result', [types[0].concert_id,
        'Nguyễn An', 'an@example.com', '0901234567', JSON.stringify(quantities.map((quantity, i) => ({ ticket_type_id: types[i].id, quantity }))), globalThis.crypto.randomUUID()])).rows[0].result.order_id;
    };
    const existing = await makeOrder([2, 1]);
    const pending = await makeOrder([1]);
    await db.query("update public.orders set status='confirmed', payment_status='paid' where id=$1", [existing]);
    await db.exec(await readFile(new URL('../supabase/migrations/202609080004_digital_tickets.sql', import.meta.url), 'utf8'));
    const ticketsFor = async id => (await db.query('select * from public.tickets where order_id=$1 order by ticket_code', [id])).rows;
    const tickets = await ticketsFor(existing);
    assert.equal(tickets.length, 3, 'existing paid orders are backfilled');
    assert.equal((await ticketsFor(pending)).length, 0);
    for (const field of ['id', 'ticket_code', 'verification_token']) assert.equal(new Set(tickets.map(t => t[field])).size, 3);
    assert.equal(tickets.filter(t => t.ticket_name === 'STANDARD').length, 2);
    assert.equal(tickets.filter(t => t.ticket_name === 'VIP').length, 1);
    for (const t of tickets) {
      assert.equal(t.user_id, owner); assert.equal(t.order_id, existing); assert.equal(t.concert_id, types[0].concert_id);
      assert.equal(t.status, 'valid'); assert.equal(t.used_at, null);
      assert.match(t.ticket_code, /^TNL-TKT-[0-9A-F]{32}$/);
      const item = (await db.query('select * from public.order_items where id=$1', [t.order_item_id])).rows[0];
      assert.equal(item.order_id, existing); assert.equal(t.ticket_type_id, item.ticket_type_id);
      assert.ok(t.admission_number <= item.quantity);
    }
    const soldBefore = (await db.query('select sold_quantity from public.ticket_types order by id')).rows;
    assert.equal((await db.query('select public.issue_tickets_for_order($1) as count', [existing])).rows[0].count, 3);
    await db.query("update public.orders set status='confirmed', payment_status='paid' where id=$1", [existing]);
    assert.deepEqual(await ticketsFor(existing), tickets, 'retries preserve exact rows, tokens and statuses');
    assert.deepEqual((await db.query('select sold_quantity from public.ticket_types order by id')).rows, soldBefore, 'issuance never reserves inventory a second time');

    await assert.rejects(db.query('select public.issue_tickets_for_order($1)', [pending]), /ORDER_NOT_ELIGIBLE/);
    await db.query("update public.orders set status='confirmed' where id=$1", [pending]);
    assert.equal((await ticketsFor(pending)).length, 0, 'confirmed but unpaid does not issue');
    await db.query("update public.orders set status='pending', payment_status='paid' where id=$1", [pending]);
    assert.equal((await ticketsFor(pending)).length, 0, 'paid but pending does not issue');
    await assert.rejects(db.query('select public.issue_tickets_for_order($1)', [pending]), /ORDER_NOT_ELIGIBLE/);
    await db.query("update public.orders set status='confirmed' where id=$1", [pending]);
    assert.equal((await ticketsFor(pending)).length, 1);
    const triple = await makeOrder([3]);
    await db.query("update public.orders set status='confirmed', payment_status='paid' where id=$1", [triple]);
    assert.equal((await ticketsFor(triple)).length, 3);

    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.tickets where ticket_code=$1', [tickets[0].ticket_code])).rows.length, 1);
    await assert.rejects(db.query('select public.issue_tickets_for_order($1)', [existing]), /permission denied/);
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
      assert.equal((await db.query("select has_table_privilege(current_user, 'public.tickets', $1) as allowed", [privilege])).rows[0].allowed, false);
    }
    await assert.rejects(db.exec("update public.tickets set status='used', used_at=now()"), /permission denied/);
    await assert.rejects(db.exec("update public.orders set payment_status='paid'"), /permission denied/);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.tickets where ticket_code=$1', [tickets[0].ticket_code])).rows.length, 0);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.exec('select * from public.tickets'), /permission denied/);
    await assert.rejects(db.query('select public.issue_tickets_for_order($1)', [existing]), /permission denied/);
    const verified = (await db.query('select * from public.verify_ticket($1)', [tickets[0].verification_token])).rows[0];
    assert.deepEqual(Object.keys(verified).sort(), ['is_valid', 'ticket_code', 'ticket_name', 'concert_name', 'concert_starts_at', 'venue', 'status'].sort());
    assert.equal(verified.is_valid, true);
    await db.query('select * from public.verify_ticket($1)', [tickets[0].verification_token]);
    assert.equal((await db.query('select * from public.verify_ticket($1)', [globalThis.crypto.randomUUID()])).rows.length, 0);
    assert.equal((await db.query('select * from public.verify_ticket(null)')).rows.length, 0);
    await db.exec('reset role');
    assert.deepEqual(await ticketsFor(existing), tickets, 'verification never marks a ticket used');

    await db.query("update public.tickets set status='used', used_at=now() where id=$1", [tickets[0].id]);
    const used = (await db.query('select * from public.verify_ticket($1)', [tickets[0].verification_token])).rows[0];
    assert.equal(used.is_valid, false); assert.equal(used.status, 'used');
    await db.query('select public.issue_tickets_for_order($1)', [existing]);
    assert.equal((await ticketsFor(existing))[0].status, 'used');
    await db.query("update public.orders set payment_status='refunded' where id=$1", [existing]);
    const revoked = await ticketsFor(existing);
    assert.equal(revoked.filter(t => t.status === 'cancelled').length, 2);
    const cancelled = (await db.query('select * from public.verify_ticket($1)', [tickets[1].verification_token])).rows[0];
    assert.equal(cancelled.is_valid, false); assert.equal(cancelled.status, 'cancelled');
    await db.query("update public.orders set payment_status='paid' where id=$1", [existing]);
    assert.deepEqual(await ticketsFor(existing), revoked, 'restoring paid does not revive cancelled/used tickets');

    const broken = await makeOrder([1]);
    await db.query('update public.order_items set quantity=2, subtotal=2::bigint*unit_price where order_id=$1', [broken]);
    await assert.rejects(db.query("update public.orders set status='confirmed', payment_status='paid' where id=$1", [broken]), /ORDER_ITEMS_MISMATCH/);
    assert.equal((await ticketsFor(broken)).length, 0);
    assert.equal((await db.query('select payment_status from public.orders where id=$1', [broken])).rows[0].payment_status, 'unpaid');

    // A failure partway through inserting admissions also rolls back the paid transition.
    const interrupted = await makeOrder([3]);
    await db.exec(`create function public.fail_third_admission_test() returns trigger language plpgsql as $$
      begin if new.admission_number = 3 then raise exception 'test admission failure'; end if; return new; end; $$;
      create trigger fail_third_admission_test before insert on public.tickets for each row execute function public.fail_third_admission_test();`);
    await assert.rejects(db.query("update public.orders set status='confirmed', payment_status='paid' where id=$1", [interrupted]), /test admission failure/);
    assert.equal((await ticketsFor(interrupted)).length, 0);
    assert.equal((await db.query('select payment_status from public.orders where id=$1', [interrupted])).rows[0].payment_status, 'unpaid');
    await db.exec('drop trigger fail_third_admission_test on public.tickets; drop function public.fail_third_admission_test();');
  } finally { await db.close(); }
});
