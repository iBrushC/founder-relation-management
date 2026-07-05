"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icons, type IconKey } from "@/lib/icons";
import type { Tone } from "@/lib/data";
import { toneBg, initials } from "@/lib/tone";

/**
 * A self-contained, interactive miniature of the SFRM app for the landing page.
 * Four tabs of clickable sample data: pick a person and log a check-in, click
 * through projects and toggle their tasks, RSVP to events — all reusing the
 * app's tokens, tone chips, and pop motion.
 */

type Person = {
  id: string;
  name: string;
  role: string;
  tone: Tone;
  tag: string;
  last: string;
};

type Update = {
  id: string;
  who: string;
  tone: Tone;
  text: string;
  when: string;
};

type DemoTask = { id: string; label: string; done: boolean };

type DemoProject = {
  id: string;
  name: string;
  icon: IconKey;
  tone: Tone;
  summary: string;
  status: { label: string; tone: Tone };
  tasks: DemoTask[];
};

type DemoEvent = {
  id: string;
  name: string;
  when: string;
  where: string;
  tone: Tone;
};

const PEOPLE: Person[] = [
  { id: "maya", name: "Maya Chen", role: "Co-founder", tone: "green", tag: "Team", last: "Coffee · 2d ago" },
  { id: "devon", name: "Devon Ellis", role: "Seed investor", tone: "blue", tag: "Investor", last: "Intro call · 1w ago" },
  { id: "priya", name: "Priya Raman", role: "Faculty mentor", tone: "purple", tag: "Mentor", last: "Office hours · 3w ago" },
  { id: "sam", name: "Sam Okafor", role: "Design lead", tone: "amber", tag: "Advisor", last: "Deck review · 5d ago" },
];

const PROJECTS: DemoProject[] = [
  {
    id: "lumen",
    name: "Lumen",
    icon: "sparkles",
    tone: "green",
    summary: "AI study companion",
    status: { label: "On track", tone: "green" },
    tasks: [
      { id: "l1", label: "Ship onboarding v2", done: false },
      { id: "l2", label: "Finalize eval dataset", done: false },
      { id: "l3", label: "Send deck to Alder", done: false },
      { id: "l4", label: "Draft pilot outreach", done: true },
      { id: "l5", label: "Set up analytics", done: true },
    ],
  },
  {
    id: "fellowship",
    name: "Founders Fellowship",
    icon: "target",
    tone: "amber",
    summary: "Application & outreach",
    status: { label: "Due soon", tone: "amber" },
    tasks: [
      { id: "f1", label: "Send one-pager to Elena", done: false },
      { id: "f2", label: "Line up two references", done: true },
    ],
  },
  {
    id: "northwind",
    name: "Northwind Pilot",
    icon: "briefcase",
    tone: "slate",
    summary: "Design-partner pilot",
    status: { label: "Paused", tone: "slate" },
    tasks: [{ id: "n1", label: "Revisit scope after pilot", done: false }],
  },
];

const EVENTS: DemoEvent[] = [
  { id: "demo-day", name: "Pre-seed Demo Day", when: "Jul 12", where: "Mission Bay, SF", tone: "purple" },
  { id: "office-hours", name: "Alder Office Hours", when: "in 5 days", where: "Menlo Park", tone: "blue" },
  { id: "design-meetup", name: "Design Systems Meetup", when: "Jul 18", where: "Northwind HQ", tone: "teal" },
  { id: "mixer", name: "Founders Mixer", when: "Jun 18", where: "The Assembly, SF", tone: "green" },
];

const SEED_UPDATES: Update[] = [
  { id: "u1", who: "Priya Raman", tone: "purple", text: "Send the revised pitch deck", when: "Due Fri" },
  { id: "u2", who: "Devon Ellis", tone: "blue", text: "Share the traction numbers", when: "Due Mon" },
];

const CHECKINS = [
  "Grabbed coffee — talked hiring",
  "Quick call — good energy",
  "Shared the latest metrics",
  "Asked for an intro",
  "Followed up on the deck",
];

const SEED_GOING: Record<string, boolean> = { "office-hours": true, "demo-day": true };

const TABS = [
  { id: "connections", label: "People" },
  { id: "projects", label: "Projects" },
  { id: "events", label: "Events" },
  { id: "updates", label: "Follow-ups" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function LandingDemo() {
  const [tab, setTab] = useState<Tab>("connections");
  const [selected, setSelected] = useState<string>("maya");
  const [selectedProject, setSelectedProject] = useState<string>(PROJECTS[0].id);
  const [updates, setUpdates] = useState<Update[]>(SEED_UPDATES);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [nextCheckin, setNextCheckin] = useState(0);
  const [taskDone, setTaskDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PROJECTS.flatMap((p) => p.tasks.map((t) => [t.id, t.done]))),
  );
  const [going, setGoing] = useState<Record<string, boolean>>(SEED_GOING);

  const person = PEOPLE.find((p) => p.id === selected) ?? PEOPLE[0];
  const project = PROJECTS.find((p) => p.id === selectedProject) ?? PROJECTS[0];

  function logCheckin() {
    const id = `u-${updates.length}-${nextCheckin}`;
    const next: Update = {
      id,
      who: person.name,
      tone: person.tone,
      text: CHECKINS[nextCheckin % CHECKINS.length],
      when: "Just now",
    };
    setUpdates((prev) => [next, ...prev]);
    setJustAdded(id);
    setNextCheckin((n) => n + 1);
    setTab("updates");
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="grid size-4 place-items-center rounded bg-primary font-heading text-[9px] font-bold text-primary-foreground">
            S
          </span>
          <span className="tabular-nums">sfrm.network</span>
        </div>
      </div>

      {/* Title */}
      <div className="border-b border-border px-4 py-3">
        <div className="eyebrow">Home</div>
        <div className="mt-0.5 text-sm font-medium">
          {PEOPLE.length} people · {PROJECTS.length} projects ·{" "}
          <span className="tabular-nums">{updates.length}</span> follow-ups
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
        {TABS.map((t) => (
          <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {/* Body */}
      {tab === "connections" && (
        <div className="grid gap-0 sm:grid-cols-[1fr_240px]">
          {/* People list */}
          <ul className="divide-y divide-border">
            {PEOPLE.map((p) => {
              const active = p.id === selected;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(p.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      active ? "bg-muted/60" : "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                        toneBg[p.tone],
                      )}
                      aria-hidden
                    >
                      {initials(p.name)}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.role}
                      </span>
                    </span>
                    <span className={cn("hidden h-5 items-center rounded-[5px] px-2 text-xs font-medium sm:inline-flex", toneBg[p.tone])}>
                      {p.tag}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Detail rail */}
          <div className="flex flex-col gap-3 border-t border-border p-4 sm:border-t-0 sm:border-l">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "inline-grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
                  toneBg[person.tone],
                )}
                aria-hidden
              >
                {initials(person.name)}
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold">{person.name}</div>
                <div className="truncate text-xs text-muted-foreground">{person.role}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icons.clock className="size-3.5 shrink-0" />
              <span className="truncate">{person.last}</span>
            </div>

            <button
              type="button"
              onClick={logCheckin}
              className="mt-auto flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Icons.coffee className="size-4" />
              Log a check-in
            </button>
          </div>
        </div>
      )}

      {tab === "projects" && (
        <div className="grid gap-0 sm:grid-cols-[1fr_260px]">
          {/* Project list */}
          <ul className="divide-y divide-border">
            {PROJECTS.map((pr) => {
              const active = pr.id === selectedProject;
              const Icon = Icons[pr.icon];
              const total = pr.tasks.length;
              const done = pr.tasks.filter((t) => taskDone[t.id]).length;
              return (
                <li key={pr.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedProject(pr.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      active ? "bg-muted/60" : "hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-grid size-8 shrink-0 place-items-center rounded-md",
                        toneBg[pr.tone],
                      )}
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-medium">{pr.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {pr.summary}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
                      {done}/{total}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Project detail rail — status, progress, toggleable tasks */}
          <ProjectDetail
            project={project}
            taskDone={taskDone}
            onToggle={(id) => setTaskDone((prev) => ({ ...prev, [id]: !prev[id] }))}
          />
        </div>
      )}

      {tab === "events" && (
        <ul className="divide-y divide-border">
          {EVENTS.map((ev) => {
            const isGoing = going[ev.id];
            return (
              <li key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    "inline-grid size-9 shrink-0 place-items-center rounded-md",
                    toneBg[ev.tone],
                  )}
                  aria-hidden
                >
                  <Icons.calendar className="size-4" />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium">{ev.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="tabular-nums">{ev.when}</span> · {ev.where}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setGoing((prev) => ({ ...prev, [ev.id]: !prev[ev.id] }))}
                  aria-pressed={isGoing}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1 rounded-[5px] px-2 py-1 text-xs font-medium transition-colors",
                    isGoing
                      ? "bg-primary text-primary-foreground"
                      : "border border-input text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {isGoing ? (
                    <>
                      <Icons.check className="size-3.5" /> Going
                    </>
                  ) : (
                    <>
                      <Icons.plus className="size-3.5" /> RSVP
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "updates" && (
        <ul className="divide-y divide-border">
          {updates.map((u) => (
            <li
              key={u.id}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5",
                u.id === justAdded && "sfrm-pop-in",
              )}
            >
              <span
                className={cn(
                  "inline-grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  toneBg[u.tone],
                )}
                aria-hidden
              >
                {initials(u.who)}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium">{u.text}</span>
                <span className="block truncate text-xs text-muted-foreground">{u.who}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {u.when}
              </span>
            </li>
          ))}
          <li className="px-4 py-3">
            <button
              type="button"
              onClick={() => setTab("connections")}
              className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-opacity hover:opacity-80"
            >
              Pick someone to check in with
              <Icons.arrowUpRight className="size-3.5" />
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function ProjectDetail({
  project,
  taskDone,
  onToggle,
}: {
  project: DemoProject;
  taskDone: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const total = project.tasks.length;
  const done = project.tasks.filter((t) => taskDone[t.id]).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 border-t border-border p-4 sm:border-t-0 sm:border-l">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-sm font-semibold">{project.name}</div>
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-[5px] px-2 text-xs font-medium",
            toneBg[project.status.tone],
          )}
        >
          <span className="size-1.5 rounded-full bg-current opacity-80" />
          {project.status.label}
        </span>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0 tabular-nums">
          {done}/{total} done
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Toggleable task checklist */}
      <ul className="flex flex-col gap-0.5">
        {project.tasks.map((t) => {
          const isDone = taskDone[t.id];
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onToggle(t.id)}
                aria-pressed={isDone}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors",
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input",
                  )}
                >
                  {isDone ? <Icons.check className="size-3" /> : null}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    isDone && "text-muted-foreground line-through",
                  )}
                >
                  {t.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 cursor-pointer rounded-md px-2.5 py-1 font-heading text-[11px] tracking-wider uppercase transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      {children}
    </button>
  );
}
