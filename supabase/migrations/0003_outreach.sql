-- SFRM outreach — per-project campaigns to track messages and follow-up reminders.
--
-- Hand-written twin of the Drizzle `projectOutreach` table (drizzle/schema.ts).
-- Idempotent: safe to re-run in the Supabase SQL editor or via `supabase db push`.
-- Also extends the derived `public.updates` view (defined in 0002) with pending
-- outreach follow-ups so reminders surface on the homepage feed.

/* ------------------------------------------------------------------ */
/*  1. Table                                                           */
/* ------------------------------------------------------------------ */

-- One outreach campaign/thread under a project. `follow_up_at` is the reminder
-- date (the app defaults it to a week out when a campaign is created).
create table if not exists public.project_outreach (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  project_id     uuid not null references public.projects (id) on delete cascade,
  connection_id  uuid references public.connections (id) on delete set null,  -- optional recipient
  label          text not null,                       -- campaign name
  channel        text,                                -- email / linkedin / phone / other
  status         text not null default 'Not started', -- Not started / Sent / Awaiting reply / Replied / Closed
  last_contacted date,
  follow_up_at   date,                                -- reminder date (defaults to +1 week at creation)
  notes          text,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/*  2. Indexes                                                         */
/* ------------------------------------------------------------------ */

create index if not exists project_outreach_owner_id_idx      on public.project_outreach (owner_id);
create index if not exists project_outreach_project_id_idx    on public.project_outreach (project_id);
create index if not exists project_outreach_connection_id_idx on public.project_outreach (connection_id);
create index if not exists project_outreach_follow_up_at_idx  on public.project_outreach (follow_up_at);

/* ------------------------------------------------------------------ */
/*  3. RLS — owner-scoped, mirrors every other data table              */
/* ------------------------------------------------------------------ */

alter table public.project_outreach enable row level security;

drop policy if exists "Owner can view own rows" on public.project_outreach;
create policy "Owner can view own rows" on public.project_outreach
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Owner can insert own rows" on public.project_outreach;
create policy "Owner can insert own rows" on public.project_outreach
  for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists "Owner can update own rows" on public.project_outreach;
create policy "Owner can update own rows" on public.project_outreach
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

drop policy if exists "Owner can delete own rows" on public.project_outreach;
create policy "Owner can delete own rows" on public.project_outreach
  for delete to authenticated using ((select auth.uid()) = owner_id);

/* ------------------------------------------------------------------ */
/*  4. updated_at trigger (function defined in 0002)                   */
/* ------------------------------------------------------------------ */

drop trigger if exists set_updated_at on public.project_outreach;
create trigger set_updated_at before update on public.project_outreach
  for each row execute function public.handle_updated_at();

/* ------------------------------------------------------------------ */
/*  5. Extend the derived "Updates" feed with outreach follow-ups      */
/* ------------------------------------------------------------------ */

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
