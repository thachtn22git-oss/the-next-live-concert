import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
export const user = '75000000-0000-4000-8000-000000000001';
export const admin = '75000000-0000-4000-8000-000000000002';
export async function migration(db,name) { return db.exec(await readFile(new URL('../../supabase/migrations/' + name,import.meta.url),'utf8')); }
export async function phase7Db() {
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for (const name of ['202609070001_public_concerts.sql','202609080001_auth_profiles.sql','202609080002_ticket_types.sql','202609080003_orders.sql','202609080004_digital_tickets.sql','202609080005_admin_dashboard.sql']) await migration(db,name);
  await db.query('insert into auth.users(id) values ($1),($2)',[user,admin]);
  await db.query("update public.profiles set role='admin' where id=$1",[admin]);
  await db.exec(`insert into public.concerts(id,slug,name,venue,starts_at,ends_at,is_published) values ('75000000-0000-4000-8000-000000000010','test','Test','Venue',now()+interval '1 day',now()+interval '2 days',true);
    insert into public.ticket_types(id,concert_id,name,slug,price,total_quantity,max_per_order) values
    ('75000000-0000-4000-8000-000000000011','75000000-0000-4000-8000-000000000010','VIP','vip',100,1000,4),
    ('75000000-0000-4000-8000-000000000012','75000000-0000-4000-8000-000000000010','Standard','standard',50,1000,4);`);
  return db;
}
export async function as(db,id,role='authenticated') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id || '']); await db.exec('set role '+role); }
export async function order(db,quantity=1) {
  await as(db,user);
  const result=await db.query(`select public.create_order('75000000-0000-4000-8000-000000000010','Test','test@example.com','0901234567',$1,$2) as result`,[JSON.stringify([{ ticket_type_id:'75000000-0000-4000-8000-000000000011',quantity }]),globalThis.crypto.randomUUID()]);
  await db.exec('reset role'); return result.rows[0].result.order_id;
}
