-- Gmail thread mirror — SQL-only objects Drizzle can't manage.
--
-- The `email_threads` table itself (columns, FKs, indexes, and its four owner
-- RLS policies) lives in drizzle/schema.ts and is created by `drizzle-kit
-- migrate`. This file holds only the `updated_at` trigger, matching the
-- convention in 0002 and 0005. Apply AFTER the Drizzle migrations. Idempotent.

/* ------------------------------------------------------------------ */
/*  1. updated_at trigger (handle_updated_at is defined in 0001)       */
/* ------------------------------------------------------------------ */

drop trigger if exists set_updated_at on public.email_threads;
create trigger set_updated_at
  before update on public.email_threads
  for each row execute function public.handle_updated_at();
