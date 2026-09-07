import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migration, repeatable seed, integrity constraints and public RLS', async () => {
  const db = new PGlite();
  try {
    // Supabase supplies these roles; the isolated PostgreSQL instance does not.
    await db.exec('create role anon; create role authenticated;');
    await db.exec(await readFile(new URL('../supabase/migrations/202609070001_public_concerts.sql', import.meta.url), 'utf8'));
    const seed = await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
    await db.exec(seed);
    await db.exec(seed);
    for (const [table, expected] of [['concerts', 1], ['artists', 5], ['concert_artists', 5], ['schedules', 7]]) {
      const result = await db.query('select count(*)::int as count from public.' + table);
      assert.equal(result.rows[0].count, expected, table);
    }
    await assert.rejects(db.exec("update public.schedules set ends_at = starts_at"), /schedule_time_range/);
    await assert.rejects(db.exec("update public.schedules set artist_id = '99999999-0000-4000-8000-000000000001'"), /foreign key/);
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      assert.equal((await db.query('select * from public.artists')).rows.length, 5);
      assert.equal((await db.query('select * from public.schedules')).rows.length, 7);
      for (const table of ['concerts', 'artists', 'concert_artists', 'schedules']) {
        for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
          const result = await db.query('select has_table_privilege(current_user, $1, $2) as allowed', ['public.' + table, privilege]);
          assert.equal(result.rows[0].allowed, false, role + ' ' + table + ' ' + privilege);
        }
      }
      await assert.rejects(db.exec("delete from public.artists"), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec("update public.artists set is_published = false where slug = 'an-nhien'");
    await db.exec('set role anon');
    assert.equal((await db.query('select * from public.artists')).rows.length, 4);
    assert.equal((await db.query('select * from public.concert_artists')).rows.length, 4);
    assert.equal((await db.query('select * from public.schedules')).rows.length, 6);
    await db.exec('reset role');
    await db.exec("update public.schedules set is_published = false where title = 'Mở cửa'");
    await db.exec('set role anon');
    assert.equal((await db.query('select * from public.schedules')).rows.length, 5);
    await db.exec('reset role');
    await db.exec('update public.concerts set is_published = false');
    await db.exec('set role anon');
    for (const table of ['concerts', 'concert_artists', 'schedules']) {
      assert.equal((await db.query('select * from public.' + table)).rows.length, 0, table);
    }
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
