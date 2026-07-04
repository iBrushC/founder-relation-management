-- SFRM core CRM schema — connections, projects (tasks/stages/participants),
-- events (participants), and a derived `updates` feed.
--
-- Hand-written twin of drizzle/migrations/0001_dusty_moira_mactaggert.sql. It is
-- the complete, idempotent apply: run it in the Supabase SQL editor OR let
-- `drizzle-kit migrate` create the tables and run this afterward for the pieces
-- Drizzle does not manage (updated_at triggers + the `updates` view). Every
-- statement is guarded (if not exists / drop-create) so it is safe to re-run.
--
-- Security architecture, layer 2 of 3: RLS. Single tenant per user — every table
-- carries owner_id and the policies scope all access to auth.uid().

/* ------------------------------------------------------------------ */
/*  1. Enums                                                           */
/* ------------------------------------------------------------------ */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tone') then
    create type public.tone as enum
      ('red', 'amber', 'blue', 'green', 'purple', 'teal', 'slate');
  end if;
  if not exists (select 1 from pg_type where typname = 'event_category') then
    create type public.event_category as enum
      ('mixer', 'demo_day', 'meetup', 'meeting', 'check_in', 'milestone', 'info_session', 'other');
  end if;
end $$;

/* ------------------------------------------------------------------ */
/*  2. Tables                                                          */
/* ------------------------------------------------------------------ */

-- People the founder knows. Tags, the interaction timeline, and notes are kept
-- inline as JSONB — small, always loaded with the row, never queried alone.
create table if not exists public.connections (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null,
  role          text,
  company       text,
  avatar_tone   public.tone not null default 'slate',
  email         text,
  phone         text,
  location      text,
  birthday      date,                       -- month/day drive reminders; year may be a placeholder
  tags          jsonb not null default '[]'::jsonb,   -- [{ label, tone }]
  interactions  jsonb not null default '[]'::jsonb,   -- [{ label, when }] timeline, newest first
  notes         jsonb not null default '[]'::jsonb,   -- [{ id, body, createdAt }]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null,
  icon          text not null default 'folder',   -- key from lib/icons
  tone          public.tone not null default 'slate',
  summary       text,
  description   text,
  status_label  text,                              -- e.g. "On track" / "Due soon" / "Paused"
  status_tone   public.tone not null default 'slate',
  tags          jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.project_tasks (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  connection_id uuid references public.connections (id) on delete set null,  -- optional primary contact
  label         text not null,
  done          boolean not null default false,
  due_date      date,
  description   text,
  subtasks      jsonb not null default '[]'::jsonb,   -- [{ id, label, done }]
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Gantt bars. Stages routinely overlap; range is inclusive.
create table if not exists public.project_stages (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  label         text not null,
  tone          public.tone not null default 'slate',
  start_date    date not null,
  end_date      date not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Which connections are involved in a project (queried, so its own table).
create table if not exists public.project_participants (
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  role          text,                                 -- optional role on this project
  created_at    timestamptz not null default now(),
  primary key (project_id, connection_id)
);

-- Mixers, demo days, meetups, check-ins, milestones. `upcoming` is derived from
-- event_date vs. today. A "check_in" is how connection follow-ups are modeled.
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null,
  category      public.event_category not null default 'other',
  event_date    date not null,
  start_time    time,                                 -- null for all-day
  location      text,
  organizers    jsonb not null default '[]'::jsonb,   -- ["Alder Ventures", ...] orgs or people
  met_guests    jsonb not null default '[]'::jsonb,   -- people met who aren't connections yet
  project_id    uuid references public.projects (id) on delete set null,  -- optional related project
  note          text,
  avatar_tone   public.tone not null default 'slate',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Which connections were met at an event (queried, so its own table).
create table if not exists public.event_participants (
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  event_id      uuid not null references public.events (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (event_id, connection_id)
);

/* ------------------------------------------------------------------ */
/*  3. Indexes                                                         */
/* ------------------------------------------------------------------ */

create index if not exists connections_owner_id_idx            on public.connections (owner_id);
create index if not exists connections_birthday_idx            on public.connections (birthday);
create index if not exists projects_owner_id_idx               on public.projects (owner_id);
create index if not exists project_tasks_owner_id_idx          on public.project_tasks (owner_id);
create index if not exists project_tasks_project_id_idx        on public.project_tasks (project_id);
create index if not exists project_tasks_due_date_idx          on public.project_tasks (due_date);
create index if not exists project_stages_owner_id_idx         on public.project_stages (owner_id);
create index if not exists project_stages_project_id_idx       on public.project_stages (project_id);
create index if not exists project_participants_owner_id_idx   on public.project_participants (owner_id);
create index if not exists project_participants_connection_id_idx on public.project_participants (connection_id);
create index if not exists events_owner_id_idx                 on public.events (owner_id);
create index if not exists events_event_date_idx               on public.events (event_date);
create index if not exists events_project_id_idx               on public.events (project_id);
create index if not exists event_participants_owner_id_idx     on public.event_participants (owner_id);
create index if not exists event_participants_connection_id_idx on public.event_participants (connection_id);

/* ------------------------------------------------------------------ */
/*  4. RLS — a user may only see or change their own rows              */
/* ------------------------------------------------------------------ */

-- Every table here has an owner_id column, so one owner-scoped policy set works
-- for all of them. Applied via a loop to keep it terse and idempotent.
do $$
declare
  tbl text;
  owned constant text[] := array[
    'connections', 'projects', 'project_tasks', 'project_stages',
    'project_participants', 'events', 'event_participants'
  ];
begin
  foreach tbl in array owned loop
    execute format('alter table public.%I enable row level security', tbl);

    execute format('drop policy if exists "Owner can view own rows" on public.%I', tbl);
    execute format(
      'create policy "Owner can view own rows" on public.%I for select to authenticated using ((select auth.uid()) = owner_id)',
      tbl);

    execute format('drop policy if exists "Owner can insert own rows" on public.%I', tbl);
    execute format(
      'create policy "Owner can insert own rows" on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)',
      tbl);

    execute format('drop policy if exists "Owner can update own rows" on public.%I', tbl);
    execute format(
      'create policy "Owner can update own rows" on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',
      tbl);

    execute format('drop policy if exists "Owner can delete own rows" on public.%I', tbl);
    execute format(
      'create policy "Owner can delete own rows" on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)',
      tbl);
  end loop;
end $$;

/* ------------------------------------------------------------------ */
/*  5. updated_at triggers                                            */
/* ------------------------------------------------------------------ */

-- Defined in 0001_profiles.sql; repeated here so this file stands alone.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
/*  6. Derived "Updates" feed                                          */
/* ------------------------------------------------------------------ */

-- The homepage feed is sourced from the tables, not stored. Next birthday for a
-- connection, robust against Feb 29 (Postgres clamps date + interval).
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

-- security_invoker = on: the view runs with the querying user's privileges, so
-- the base-table RLS above still scopes every row to its owner. Consumers should
-- window + order + limit (e.g. where sort_at <= current_date + 30, order by sort_at).
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
  where c.birthday is not null;

comment on view public.updates is
  'Derived homepage feed: task deadlines + upcoming events + connection birthdays. Not a stored table.';

grant select on public.updates to authenticated;
