begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 32),
  avatar_url text check (char_length(avatar_url) <= 2048),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
-- RLS controls rows; column grants prevent changes to role, id and timestamps.
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

create policy "Read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create function public.create_signup_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 120), ''),
    nullif(left(trim(new.raw_user_meta_data ->> 'phone'), 32), ''),
    'user'
  );
  return new;
end;
$$;
revoke all on function public.create_signup_profile() from public, anon, authenticated;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_signup_profile();

create function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.touch_profile_updated_at() from public, anon, authenticated;
create trigger touch_profile_before_update
  before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

-- Include accounts created before this migration; never trust metadata roles.
insert into public.profiles (id, full_name, phone, role)
select id, nullif(left(trim(raw_user_meta_data ->> 'full_name'), 120), ''),
  nullif(left(trim(raw_user_meta_data ->> 'phone'), 32), ''), 'user'
from auth.users
on conflict (id) do nothing;

commit;
