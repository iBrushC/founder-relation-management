-- SFRM outreach — SQL-only objects for per-project outreach follow-ups.
--
-- Drizzle is the single source of truth for the schema: the `project_outreach`
-- table, its indexes, RLS, and policies live in drizzle/schema.ts and are
-- created by `drizzle-kit migrate`. This file holds only what Drizzle can't
-- manage — the `updated_at` trigger and the derived `public.updates` view (the
-- homepage feed), defined here in full since outreach is its last source.
-- Apply AFTER the Drizzle migrations. Every statement is idempotent.

/* ------------------------------------------------------------------ */
/*  1. updated_at trigger (handle_updated_at is defined in 0001)       */
/* ------------------------------------------------------------------ */

drop trigger if exists set_updated_at on public.project_outreach;
create trigger set_updated_at before update on public.project_outreach
  for each row execute function public.handle_updated_at();

/* ------------------------------------------------------------------ */
/*  2. Derived "Updates" feed                                          */
/* ------------------------------------------------------------------ */

-- The homepage feed is sourced from the tables, not stored. security_invoker =
-- on: the view runs with the querying user's privileges, so the base-table RLS
-- still scopes every row to its owner. Consumers should window + order + limit
-- (e.g. where sort_at <= current_date + 30, order by sort_at).
create or replace view public.updates
with (security_invoker = on) as

  -- Task deadlines
  select
    'task:' || t.id::text                                    as id,
    t.owner_id                                               as owner_id,
    'task'                                                   as source,
    t.due_date                                               as sort_at,
    'flag'                                                   as icon,
    t.label                                                  as title,
    'Deadline'                                               as kind,
    'red'::public.tone                                       as tone,
    t.description                                            as detail,
    case when t.connection_id is not null
         then array[t.connection_id] else '{}'::uuid[] end   as connection_ids,
    array[t.project_id]                                      as project_ids
  from public.project_tasks t
  where t.done = false and t.due_date is not null

  union all

  -- Upcoming events (meetings, check-ins, milestones, mixers, …)
  select
    'event:' || e.id::text,
    e.owner_id,
    'event',
    e.event_date,
    case e.category when 'check_in' then 'coffee'
                    when 'milestone' then 'star'
                    else 'calendarCheck' end,
    e.name,
    case e.category when 'check_in' then 'Check-in'
                    when 'milestone' then 'Milestone'
                    else 'Meeting' end,
    (case e.category when 'check_in' then 'blue'
                     when 'milestone' then 'amber'
                     else 'green' end)::public.tone,
    e.note,
    coalesce(
      (select array_agg(ep.connection_id)
         from public.event_participants ep
        where ep.event_id = e.id),
      '{}'::uuid[]),
    case when e.project_id is not null
         then array[e.project_id] else '{}'::uuid[] end
  from public.events e
  where e.event_date >= current_date

  union all

  -- Connection birthdays
  select
    'birthday:' || c.id::text,
    c.owner_id,
    'birthday',
    public.next_birthday(c.birthday),
    'cake',
    c.name || '''s birthday',
    'Birthday',
    'purple'::public.tone,
    'Birthday coming up — a good reason to reach out.',
    array[c.id],
    '{}'::uuid[]
  from public.connections c
  where c.birthday is not null

  union all

  -- Pending outreach follow-ups (a reminder to send the next message)
  select
    'outreach:' || o.id::text,
    o.owner_id,
    'outreach',
    o.follow_up_at,
    'send',
    'Follow up: ' || o.label,
    'Follow-up',
    'teal'::public.tone,
    o.notes,
    case when o.connection_id is not null
         then array[o.connection_id] else '{}'::uuid[] end,
    array[o.project_id]
  from public.project_outreach o
  where o.follow_up_at is not null
    and o.status not in ('Replied', 'Closed');

comment on view public.updates is
  'Derived homepage feed: task deadlines + upcoming events + connection birthdays + outreach follow-ups. Not a stored table.';

grant select on public.updates to authenticated;
