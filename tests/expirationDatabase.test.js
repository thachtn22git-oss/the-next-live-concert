import test from 'node:test';
import assert from 'node:assert/strict';
import { phase7Db,migration,as,order,user,admin } from './helpers/phase75Db.js';
const type='75000000-0000-4000-8000-000000000011';
test('expiration backfill, server deadlines, shared release, authorization and both race outcomes',async () => {
  const db=await phase7Db();
  try {
    const historical=await order(db,2); const paid=await order(db); const confirmed=await order(db); const pendingPaid=await order(db);
    await db.query("update public.orders set created_at=now()-interval '1 hour' where id=any($1)",[[historical,paid,confirmed,pendingPaid]]);
    await db.query("update public.orders set status='confirmed',payment_status='paid' where id=$1",[paid]);
    await db.query("update public.orders set status='confirmed' where id=$1",[confirmed]);
    await db.query("update public.orders set payment_status='paid' where id=$1",[pendingPaid]);
    await migration(db,'202609090001_order_expiration.sql');
    const get=async id => (await db.query('select * from public.orders where id=$1',[id])).rows[0];
    const stock=async () => (await db.query('select sold_quantity from public.ticket_types where id=$1',[type])).rows[0].sold_quantity;
    assert.equal(new Date((await get(historical)).expires_at)-new Date((await get(historical)).created_at),15*60000);
    for (const id of [paid,confirmed,pendingPaid]) assert.equal((await get(id)).expires_at,null);
    assert.equal((await get(historical)).status,'pending','migration does not immediately cancel history');
    const fresh=await order(db);
    assert.equal(new Date((await get(fresh)).expires_at)-new Date((await get(fresh)).created_at),15*60000);
    const before=await stock();
    await as(db,user);
    for (const sql of ['select public.expire_pending_orders()',`select public.cancel_order_and_release('${paid}',true)`]) await assert.rejects(db.exec(sql),/permission denied/);
    await assert.rejects(db.exec('select public.admin_expire_pending_orders()'),/ADMIN_REQUIRED/);
    await assert.rejects(db.exec("update public.orders set expires_at=now()"),/permission denied/);
    await as(db,null,'anon'); await assert.rejects(db.exec('select public.admin_expire_pending_orders()'),/permission denied/);
    await as(db,admin);
    assert.equal((await db.query('select public.admin_expire_pending_orders() as count')).rows[0].count,1);
    assert.equal(await stock(),before-2);
    const expired=await get(historical); assert.equal(expired.status,'cancelled'); assert.ok(expired.expired_at); assert.ok(expired.inventory_released_at);
    assert.equal((await db.query('select public.admin_expire_pending_orders() as count')).rows[0].count,0);
    await db.query('select public.admin_cancel_order($1)',[historical]); assert.equal(await stock(),before-2);
    await assert.rejects(db.query('select public.admin_confirm_order($1)',[historical]),/INVALID_TRANSITION/);
    for (const id of [paid,confirmed,pendingPaid,fresh]) assert.notEqual((await get(id)).status,'cancelled');
    // Confirmation wins the order lock first: even an elapsed deadline cannot cancel a paid order.
    await db.exec('reset role'); await db.query("update public.orders set expires_at=now()-interval '1 second' where id=$1",[fresh]);
    await as(db,admin); await db.query('select public.admin_confirm_order($1)',[fresh]);
    const wonStock=await stock(); await db.query('select public.admin_expire_pending_orders()'); assert.equal(await stock(),wonStock);
    assert.equal((await get(fresh)).status,'confirmed');
    const ticket=(await db.query('select * from public.tickets where order_id=$1',[fresh])).rows[0];
    await db.query('select public.check_in_ticket($1)',[ticket.ticket_code]);
    // Defensive eligibility: even inconsistent trusted data with a used ticket must not release.
    await db.exec('reset role'); await db.query("update public.orders set status='pending',payment_status='unpaid' where id=$1",[fresh]);
    assert.equal((await db.query('select public.expire_pending_orders() as count')).rows[0].count,0); assert.equal(await stock(),wonStock);
    await as(db,admin); await assert.rejects(db.query('select public.admin_cancel_order($1)',[fresh]),/ORDER_HAS_USED_TICKETS/);
  } finally { await db.close(); }
});
test('expiration batch rolls back all releases on underflow and remains retryable',async () => {
  const db=await phase7Db();
  try {
    await migration(db,'202609090001_order_expiration.sql');
    const first=await order(db); const second=await order(db,2);
    await db.query("update public.orders set expires_at=now()-interval '1 minute' where id=any($1)",[[first,second]]);
    await db.query('update public.ticket_types set sold_quantity=1 where id=$1',[type]);
    await assert.rejects(db.exec('select public.expire_pending_orders()'),/INVENTORY_MISMATCH/);
    assert.equal((await db.query('select sold_quantity from public.ticket_types where id=$1',[type])).rows[0].sold_quantity,1);
    for (const row of (await db.query('select status,inventory_released_at,expired_at from public.orders')).rows) {
      assert.equal(row.status,'pending'); assert.equal(row.inventory_released_at,null); assert.equal(row.expired_at,null);
    }
    await db.query('update public.ticket_types set sold_quantity=3 where id=$1',[type]);
    assert.equal((await db.query('select public.expire_pending_orders() as count')).rows[0].count,2);
    assert.equal((await db.query('select sold_quantity from public.ticket_types where id=$1',[type])).rows[0].sold_quantity,0);
    assert.equal((await db.query('select public.expire_pending_orders() as count')).rows[0].count,0);
  } finally { await db.close(); }
});
