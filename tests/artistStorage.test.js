import test from 'node:test';
import assert from 'node:assert/strict';
import { phase7Db,migration,as,user,admin } from './helpers/phase75Db.js';
import { validateArtistImage,artistImagePath,createArtistImageService,MAX_ARTIST_IMAGE_BYTES } from '../src/features/admin/artistImageService.js';
test('artist file validation, unique safe naming and upload behavior',async () => {
  for (const type of ['image/jpeg','image/png','image/webp']) assert.equal(validateArtistImage({ type,size:MAX_ARTIST_IMAGE_BYTES }), '');
  assert.match(validateArtistImage({ type:'image/svg+xml',size:100 }),/không hợp lệ/);
  assert.match(validateArtistImage({ type:'image/png',size:MAX_ARTIST_IMAGE_BYTES+1 }),/5 MB/);
  assert.match(validateArtistImage({ type:'image/png',size:0 }),/không hợp lệ/);
  const file={ name:'../../private-person.png',type:'image/png',size:123 };
  const path=artistImagePath(file); assert.match(path,/^artists\/[0-9a-f-]{36}\.png$/); assert.notEqual(path,artistImagePath(file));
  const calls=[]; const service=createArtistImageService({ storage:{ from(bucket) { calls.push(bucket); return { async upload(...args) { calls.push(args); return { data:{ path:args[0] },error:null }; },getPublicUrl(p) { return { data:{ publicUrl:'https://example.com/'+p } }; } }; } } });
  const result=await service.upload(file); assert.equal(calls[0],'artist-images'); assert.equal(calls[1][2].upsert,false); assert.equal(calls[1][1],file); assert.ok(result.url.endsWith(result.path));
  const fail=createArtistImageService({ storage:{ from() { return { async upload() { return { error:{ message:'private backend details' } }; } }; } } });
  await assert.rejects(fail.upload(file),/Chưa thể tải ảnh lên/);
  await assert.rejects(service.upload({ type:'application/pdf',size:123 }),/không hợp lệ/);
});
test('Storage policies use database admin role, even with unrelated permissive policies',async () => {
  const db=await phase7Db();
  try {
    // Minimal Storage schema fixture; exercises actual RLS, not a hosted upload.
    await db.exec(`create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon,authenticated;
      grant select,insert,update,delete on storage.objects to anon,authenticated;
      create policy unrelated_broad_policy on storage.objects for all to anon,authenticated using(true) with check(true);`);
    await migration(db,'202609090002_artist_image_storage.sql');
    const bucket=(await db.query("select * from storage.buckets where id='artist-images'")).rows[0];
    assert.equal(bucket.public,true); assert.equal(Number(bucket.file_size_limit),MAX_ARTIST_IMAGE_BYTES); assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);
    const path='artists/75000000-0000-4000-8000-000000000001.png';
    await as(db,user); await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('artist-images',$1)",[path]),/row-level security/);
    await as(db,null,'anon'); await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('artist-images',$1)",[path]),/row-level security/);
    await as(db,admin); await db.query("insert into storage.objects(bucket_id,name) values ('artist-images',$1)",[path]);
    await as(db,user); assert.equal((await db.query("update storage.objects set name='bad' returning *")).rows.length,0); assert.equal((await db.query('delete from storage.objects returning *')).rows.length,0);
    await as(db,admin); assert.equal((await db.query('update storage.objects set name=$1 returning *',[path.replace('.png','.webp')])).rows.length,1);
    assert.equal((await db.query('delete from storage.objects returning *')).rows.length,1);
  } finally { await db.close(); }
});
