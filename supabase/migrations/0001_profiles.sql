-- SFRM auth layer — profiles table, RLS, and auto-provisioning trigger.
-- Apply via the Supabase SQL Editor, or `supabase db push` once the CLI is linked.
-- Security architecture, layer 2 of 3: RLS (layer 1 = proxy, layer 3 = DAL).

-- 1. Profiles: one row per auth user, holding profile info + settings.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  -- Free-form user settings (theme, notification prefs, …). Kept as JSON so the
  -- schema stays simple while the app grows.
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Public profile + settings for each authenticated user.';

-- 2. Row Level Security: a user may only ever see or change their own row.
alter table public.profiles enable row level security;

create policy "Profiles are viewable by their owner"
  on public.profiles for select
  using ( (select auth.uid()) = id );

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( (select auth.uid()) = id );

create policy "Users can update their own profile"
  on public.profiles for update
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

-- 3. Auto-provision a profile whenever a new auth user is created.
--    full_name is read from the metadata passed at sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Keep updated_at fresh on every change.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();
