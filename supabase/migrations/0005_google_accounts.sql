-- Google OAuth links — SQL-only objects Drizzle can't manage.
--
-- The `google_accounts` table itself (columns, FK, and its deliberately
-- policy-less RLS) lives in drizzle/schema.ts and is created by
-- `drizzle-kit migrate`. This file holds only the `updated_at` trigger, matching
-- the convention in 0002. Apply AFTER the Drizzle migrations. Idempotent.

/* ------------------------------------------------------------------ */
/*  1. updated_at trigger (handle_updated_at is defined in 0001)       */
/* ------------------------------------------------------------------ */

drop trigger if exists set_updated_at on public.google_accounts;
create trigger set_updated_at
  before update on public.google_accounts
  for each row execute function public.handle_updated_at();

/* ------------------------------------------------------------------ */
/*  2. Belt and braces on the token columns                            */
/* ------------------------------------------------------------------ */

-- RLS is ENABLED WITH NO POLICIES on this table (see drizzle/schema.ts), which
-- denies `authenticated` every operation — the browser cannot reach these
-- tokens through PostgREST. The grants below make that explicit rather than
-- leaving it resting solely on Supabase's default role grants: if someone later
-- adds a policy to this table by reflex (every other table has four), the
-- missing grant still keeps the anon/authenticated roles out.
revoke all on table public.google_accounts from anon, authenticated;
