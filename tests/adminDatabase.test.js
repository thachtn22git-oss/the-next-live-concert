import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const user = '70000000-0000-4000-8000-000000000001';
const admin = '70000000-0000-4000-8000-000000000002';
test('Phase 7 database authorization, order lifecycle, inventory and atomic admission', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
    for (const file of ['migrations/202609070001_public_concerts.sql','migrations/202609080001_auth_profiles.sql','seed.sql','migrations/202609080002_ticket_types.sql','seed_tickets.sql','migrations/202609080003_orders.sql','migrations/202609080004_digital_tickets.sql','migrations/202609080005_admin_dashboard.sql']) {
      await db.exec(await readFile(new URL('../supabase/' + file, import.meta.url),'utf8'));
    }
    await db.query('insert into auth.users(id) values ($1),($2)',[user,admin]);
    await db.query("update public.profiles set role='admin' where id=$1",[admin]);
    const type = (await db.query('select * from public.ticket_types order by display_order limit 1')).rows[0];
    async function as(id,role='authenticated') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id || '']); await db.exec('set role ' + role); }
    async function makeOrder(quantity=1) { await as(user); return (await db.query('select public.create_order($1,$2,$3,$4,$5,$6) as result',[type.concert_id,'Test User','user@example.com','0901234567',JSON.stringify([{ ticket_type_id:type.id,quantity }]),globalThis.crypto.randomUUID()])).rows[0].result.order_id; }
    const order = await makeOrder(2); const cancelled = await makeOrder(); const pending = await makeOrder();
    assert.equal((await db.query('select public.is_admin() as allowed')).rows[0].allowed,false);
    for (const name of ['admin_confirm_order','admin_cancel_order']) await assert.rejects(db.query(`select public.${name}($1)`,[order]),/ADMIN_REQUIRED/);
    for (const sql of ['select public.admin_dashboard()',"select public.admin_lookup_ticket('bad')","select public.check_in_ticket('bad')"]) await assert.rejects(db.exec(sql),/ADMIN_REQUIRED/);
    await assert.rejects(db.exec("update public.profiles set role='admin'"),/permission denied/);
    for (const sql of ["update public.orders set payment_status='paid'", "update public.orders set status='confirmed'", "update public.tickets set status='used', used_at=now()",'update public.ticket_types set sold_quantity=0']) await assert.rejects(db.exec(sql),/permission denied/);
    for (const table of ['concerts','artists','schedules','ticket_types']) {
      const col = table === 'schedules' ? 'title' : 'name';
      assert.equal((await db.query(`update public.${table} set ${col}='Hacked' returning *`)).rows.length,0);
    }
    await assert.rejects(db.exec("insert into public.artists(name,slug) values ('Hacked','hacked')"),/row-level security/);
    assert.equal((await db.query('delete from public.artists returning *')).rows.length,0);
    await as(null,'anon');
    for (const sql of ['select public.admin_dashboard()',`select public.admin_confirm_order('${order}')`,"select public.check_in_ticket('bad')"]) await assert.rejects(db.exec(sql),/permission denied/);
    await as(admin);
    assert.equal((await db.query('select public.is_admin() as allowed')).rows[0].allowed,true);
    assert.equal((await db.query("update public.concerts set venue='Admin venue' where id=$1 returning *",[type.concert_id])).rows.length,1);
    const artist = (await db.query("insert into public.artists(name,slug) values ('Admin Artist','admin-artist') returning id")).rows[0].id;
    await db.query('insert into public.concert_artists(concert_id,artist_id) values ($1,$2)',[type.concert_id,artist]);
    await db.query("insert into public.schedules(concert_id,artist_id,title,starts_at,ends_at) values ($1,$2,'Slot',now(),now()+interval '1 hour')",[type.concert_id,artist]);
    await assert.rejects(db.query('delete from public.concert_artists where artist_id=$1',[artist]),/foreign key/);
    await assert.rejects(db.query('delete from public.artists where id=$1',[artist]),/foreign key/);
    await db.query('delete from public.schedules where artist_id=$1',[artist]);
    await db.query('delete from public.artists where id=$1',[artist]);
    await assert.rejects(db.query('update public.ticket_types set total_quantity=0 where id=$1',[type.id]),/check constraint/);
    await assert.rejects(db.exec('update public.ticket_types set sold_quantity=0'),/permission denied/);
    for (const table of ['concerts','ticket_types','orders','tickets']) await assert.rejects(db.exec(`delete from public.${table}`),/permission denied/);
    const initialStats = (await db.query('select public.admin_dashboard() as result')).rows[0].result;
    assert.equal(initialStats.revenue,0); assert.equal(initialStats.pending,3);
    await db.query('select public.admin_confirm_order($1)',[order]);
    const tickets = (await db.query('select * from public.tickets where order_id=$1 order by id',[order])).rows;
    assert.equal(tickets.length,2);
    await db.query('select public.admin_confirm_order($1)',[order]);
    assert.deepEqual((await db.query('select * from public.tickets where order_id=$1 order by id',[order])).rows,tickets);
    assert.equal((await db.query('select public.admin_dashboard() as result')).rows[0].result.revenue,type.price*2);
    await as(null,'anon');
    for (let i=0;i<2;i++) assert.equal((await db.query('select * from public.verify_ticket($1)',[tickets[0].verification_token])).rows[0].status,'valid');
    await as(admin);
    assert.equal((await db.query('select used_at from public.tickets where id=$1',[tickets[0].id])).rows[0].used_at,null);
    const first = (await db.query('select public.check_in_ticket($1) as result',[tickets[0].verification_token])).rows[0].result;
    assert.equal(first.status,'used'); assert.ok(first.used_at);
    assert.deepEqual(Object.keys(first).sort(),['ticket_code','ticket_name','concert_name','concert_starts_at','venue','status','used_at'].sort());
    await assert.rejects(db.query('select public.check_in_ticket($1)',[tickets[0].ticket_code]),/TICKET_ALREADY_USED/);
    assert.equal((await db.query('select public.admin_lookup_ticket($1) as result',[tickets[0].ticket_code])).rows[0].result.used_at,first.used_at);
    await assert.rejects(db.query('select public.admin_cancel_order($1)',[order]),/ORDER_HAS_USED_TICKETS/);
    await db.query('select public.admin_confirm_order($1)',[cancelled]);
    const cancelTicket = (await db.query('select * from public.tickets where order_id=$1',[cancelled])).rows[0];
    const sold = (await db.query('select sold_quantity from public.ticket_types where id=$1',[type.id])).rows[0].sold_quantity;
    await db.query('select public.admin_cancel_order($1)',[cancelled]);
    await db.query('select public.admin_cancel_order($1)',[cancelled]);
    assert.equal((await db.query('select sold_quantity from public.ticket_types where id=$1',[type.id])).rows[0].sold_quantity,sold-1);
    await assert.rejects(db.query('select public.check_in_ticket($1)',[cancelTicket.ticket_code]),/TICKET_CANCELLED/);
    await assert.rejects(db.query('select public.admin_confirm_order($1)',[cancelled]),/INVALID_TRANSITION/);
    await db.query('select public.admin_cancel_order($1)',[pending]);
    await db.query('select public.admin_cancel_order($1)',[pending]);
    assert.equal((await db.query('select sold_quantity from public.ticket_types where id=$1',[type.id])).rows[0].sold_quantity,sold-2);
    assert.equal((await db.query('select public.admin_dashboard() as result')).rows[0].result.used,1);
    await assert.rejects(db.query('select public.check_in_ticket($1)',['not-a-ticket']),/TICKET_NOT_FOUND/);
    // A failure during issuance must roll back payment confirmation.
    const broken = await makeOrder(); await db.exec('reset role');
    await db.query('update public.order_items set quantity=2,subtotal=2*unit_price where order_id=$1',[broken]);
    await as(admin); await assert.rejects(db.query('select public.admin_confirm_order($1)',[broken]),/ORDER_ITEMS_MISMATCH/);
    assert.equal((await db.query('select payment_status from public.orders where id=$1',[broken])).rows[0].payment_status,'unpaid');
    await as(user); await assert.rejects(db.query('select public.check_in_ticket($1)',[tickets[1].verification_token]),/ADMIN_REQUIRED/);
    const underflow = await makeOrder();
    await db.exec('reset role');
    const reserved = (await db.query('select sold_quantity from public.ticket_types where id=$1',[type.id])).rows[0].sold_quantity;
    await db.query('update public.ticket_types set sold_quantity=0 where id=$1',[type.id]);
    await as(admin);
    await assert.rejects(db.query('select public.admin_cancel_order($1)',[underflow]),/INVENTORY_MISMATCH/);
    const unchanged = (await db.query('select status,inventory_released_at from public.orders where id=$1',[underflow])).rows[0];
    assert.equal(unchanged.status,'pending'); assert.equal(unchanged.inventory_released_at,null);
    await db.exec('reset role');
    await db.query('update public.ticket_types set sold_quantity=$1 where id=$2',[reserved,type.id]);
    // Historical cancellation has no release marker; never release guessed inventory.
    await db.query("update public.orders set status='cancelled' where id=$1",[underflow]);
    await as(admin); await db.query('select public.admin_cancel_order($1)',[underflow]);
    assert.equal((await db.query('select sold_quantity from public.ticket_types where id=$1',[type.id])).rows[0].sold_quantity,reserved);
    // A stale frontend profile cannot retain database privileges after demotion.
    await db.exec('reset role'); await db.query("update public.profiles set role='user' where id=$1",[admin]);
    await as(admin); await assert.rejects(db.exec('select public.admin_dashboard()'),/ADMIN_REQUIRED/);
    await as(null); await assert.rejects(db.exec("select public.check_in_ticket('bad')"),/ADMIN_REQUIRED/);
  } finally { await db.close(); }
});
