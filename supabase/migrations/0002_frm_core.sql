-- SFRM core CRM — SQL-only objects Drizzle can't manage.
--
-- Drizzle is the single source of truth for the schema: the enums, tables,
-- indexes, RLS, and policies for connections / projects (tasks, stages,
-- participants) / events (participants) all live in drizzle/schema.ts and are
-- created by `drizzle-kit migrate`. This file holds only what Drizzle leaves
-- untouched — the per-table `updated_at` triggers and the `next_birthday`
-- helper used by the derived `updates` view (the view itself is in 0003).
-- Apply AFTER the Drizzle migrations. Every statement is idempotent.

/* ------------------------------------------------------------------ */
/*  1. updated_at triggers (handle_updated_at is defined in 0001)      */
/* ------------------------------------------------------------------ */

do $$
declare
  tbl text;
  -- Only the tables that carry updated_at (join tables are insert-only).
  timestamped constant text[] := array[
    'connections', 'projects', 'project_tasks', 'project_stages', 'events'
  ];
begin
  foreach tbl in array timestamped loop
    execute format('drop trigger if exists set_updated_at on public.%I', tbl);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.handle_updated_at()',
      tbl);
  end loop;
end $$;

/* ------------------------------------------------------------------ */
/*  2. Derived "Updates" feed helper                                   */
/* ------------------------------------------------------------------ */

-- Next birthday for a connection, robust against Feb 29 (Postgres clamps
-- date + interval). Consumed by the `updates` view in 0003.
create or replace function public.next_birthday(bday date)
returns date
language sql
stable
as $$
  select case
    when (bday + make_interval(years => date_part('year', age(bday))::int))::date >= current_date
      then (bday + make_interval(years => date_part('year', age(bday))::int))::date
    else   (bday + make_interval(years => date_part('year', age(bday))::int + 1))::date
  end;
$$;
