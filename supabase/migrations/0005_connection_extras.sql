-- SFRM connection extras — a LinkedIn URL and free-form key/value details.
--
-- Hand-written twin of the Drizzle `connections` table (drizzle/schema.ts).
-- Idempotent: safe to re-run in the Supabase SQL editor or via `supabase db push`.
-- Purely additive (two nullable/defaulted columns); no data migration needed.

alter table public.connections
  add column if not exists linkedin     text,
  add column if not exists extra_fields jsonb not null default '[]'::jsonb;  -- [{ label, value }]
