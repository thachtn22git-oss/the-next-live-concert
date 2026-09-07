import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('profiles trigger, backfill, private reads, column grants and role safety', async () => {
  const db = new PGlite();
  const first = '40000000-0000-4000-8000-000000000001';
  const second = '40000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    await db.query('insert into auth.users values ($1, $2)', [first, { full_name: 'Người có sẵn', role: 'admin' }]);
    await db.exec(await readFile(new URL('../supabase/migrations/202609080001_auth_profiles.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users values ($1, $2)', [second, { full_name: '  Người mới  ', phone: '0901234567', role: 'admin' }]);
    let result = await db.query('select * from public.profiles order by id');
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].role, 'user', 'backfill ignores metadata role');
    assert.equal(result.rows[1].role, 'user', 'trigger ignores metadata role');
    assert.equal(result.rows[1].full_name, 'Người mới');
    const before = result.rows[0].updated_at;

    await db.exec('set role anon');
    await assert.rejects(db.exec('select * from public.profiles'), /permission denied/);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [first]);
    await db.exec('set role authenticated');
    result = await db.query('select * from public.profiles');
    assert.deepEqual(result.rows.map(row => row.id), [first]);
    await db.query('update public.profiles set full_name = $1, phone = $2 where id = $3', ['Tên mới', '0912345678', first]);
    result = await db.query('select * from public.profiles');
    assert.equal(result.rows[0].full_name, 'Tên mới');
    assert.ok(new Date(result.rows[0].updated_at).getTime() > new Date(before).getTime());
    assert.equal((await db.query('update public.profiles set full_name = $1 where id = $2 returning id', ['Không được phép', second])).rows.length, 0);
    for (const assignment of ["role = 'admin'", "id = '" + second + "'", "created_at = now()", "updated_at = now()"]) {
      await assert.rejects(db.exec('update public.profiles set ' + assignment), /permission denied/);
    }
    await assert.rejects(db.query("insert into public.profiles (id, role) values ($1, 'admin')", [first]), /permission denied/);
    await assert.rejects(db.exec('delete from public.profiles'), /permission denied/);
    assert.equal((await db.query("select has_function_privilege(current_user, 'public.create_signup_profile()', 'execute') as allowed")).rows[0].allowed, false);
    await db.exec('reset role');
    await db.query("update auth.users set raw_user_meta_data = $1 where id = $2", [{ role: 'admin' }, first]);
    assert.equal((await db.query('select role from public.profiles where id = $1', [first])).rows[0].role, 'user');
    await db.query("update public.profiles set role = 'admin' where id = $1", [first]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.profiles')).rows.length, 1, 'admin cannot read other private profiles');
    await db.exec('reset role');
    await db.query('delete from auth.users where id = $1', [second]);
    assert.equal((await db.query('select * from public.profiles')).rows.length, 1);
  } finally { await db.close(); }
});
