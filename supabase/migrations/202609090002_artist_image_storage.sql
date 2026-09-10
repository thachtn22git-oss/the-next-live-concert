begin;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('artist-images', 'artist-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public URLs serve images; listing and all mutations are admin-only.
create policy "Admin artist image read" on storage.objects for select to authenticated
  using (bucket_id = 'artist-images' and (select public.is_admin()));
create policy "Admin artist image upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'artist-images' and (select public.is_admin())
    and name ~ '^artists/[0-9a-f-]{36}\.(jpg|png|webp)$');
create policy "Admin artist image replace" on storage.objects for update to authenticated
  using (bucket_id = 'artist-images' and (select public.is_admin()))
  with check (bucket_id = 'artist-images' and (select public.is_admin())
    and name ~ '^artists/[0-9a-f-]{36}\.(jpg|png|webp)$');
create policy "Admin artist image delete" on storage.objects for delete to authenticated
  using (bucket_id = 'artist-images' and (select public.is_admin()));

-- Restrictive guards ensure an unrelated broad Storage policy cannot open this bucket to users.
create policy "Guard artist image insert" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'artist-images' or (select public.is_admin()));
create policy "Guard artist image update" on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'artist-images' or (select public.is_admin()))
  with check (bucket_id <> 'artist-images' or (select public.is_admin()));
create policy "Guard artist image delete" on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'artist-images' or (select public.is_admin()));
create policy "Block anonymous artist image writes" on storage.objects as restrictive for all to anon
  using (bucket_id <> 'artist-images') with check (bucket_id <> 'artist-images');
commit;
