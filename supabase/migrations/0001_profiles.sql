-- SFRM auth plumbing — profile auto-provisioning + the shared updated_at helper.
--
-- Drizzle is the single source of truth for the schema: the `profiles` table,
-- its RLS, and its policies live in drizzle/schema.ts and are created by
-- `drizzle-kit migrate`. This file holds only the pieces Drizzle does NOT manage
-- — a trigger on `auth.users` and the `updated_at` trigger function — and is
-- applied AFTER the Drizzle migrations (Supabase SQL editor or `supabase db push`).
-- Every statement is idempotent, so it is safe to re-run.
--
-- Security architecture, layer 2 of 3: RLS (layer 1 = proxy, layer 3 = DAL).

-- 1. Auto-provision a profile whenever a new auth user is created.
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

-- 2. Keep updated_at fresh on every change. Shared by every timestamped table's
--    set_updated_at trigger (see 0002/0003).
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
