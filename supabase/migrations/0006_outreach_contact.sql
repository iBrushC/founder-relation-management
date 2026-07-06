-- SFRM outreach contact details — email, phone, and website per recipient.
--
-- Hand-written twin of the Drizzle `projectOutreach` table (drizzle/schema.ts).
-- Idempotent: safe to re-run in the Supabase SQL editor or via `supabase db push`.
-- Purely additive (three nullable columns); no data migration needed.

alter table public.project_outreach
  add column if not exists email   text,
  add column if not exists phone   text,
  add column if not exists website text;
