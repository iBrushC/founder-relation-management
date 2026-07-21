"use client";

import { Fragment, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { formatWhen, todayIso } from "@/lib/data/format";
import { createEvent } from "@/lib/data/actions";
import { EventsList } from "@/components/app/list-contexts";
import { InitialsAvatar } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Grow-plan event finder. Searches a local (hardcoded) mock catalog — results
 * never persist; they're purely visual until the user quick-adds one, at which
 * point the real `createEvent` server action runs and the new row pops into the
 * shared `EventsList` (mirroring the optimistic flow used by AddEventDialog).
 */

type MockEvent = {
  id: string;
  name: string;
  where: string;
  /** YYYY-MM-DD. */
  date: string;
  /** 24h "HH:MM" start time. */
  time: string;
  category: "Mixer" | "Demo" | "Meetup" | "Workshop" | "Pitch";
  link: string;
};

/** ISO date shifted `n` days from `todayIso()` (local). */
function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const MOCK_EVENTS: MockEvent[] = [
  {
    id: "mock-1",
    name: "Founder Mixer @ Pier 17",
    where: "Pier 17, New York, NY",
    date: isoOffset(0),
    time: "18:30",
    category: "Mixer",
    link: "https://lu.ma/example-mixer",
  },
  {
    id: "mock-2",
    name: "AI Demo Night",
    where: "SoHo House, New York, NY",
    date: isoOffset(0),
    time: "19:00",
    category: "Demo",
    link: "https://lu.ma/example-demo",
  },
  {
    id: "mock-3",
    name: "YC-style Office Hours",
    where: "WeWork SoHo, New York, NY",
    date: isoOffset(1),
    time: "10:00",
    category: "Workshop",
    link: "https://example.com/office-hours",
  },
  {
    id: "mock-4",
    name: "Student Founders Brunch",
    where: "Partners Coffee, West Village",
    date: isoOffset(1),
    time: "11:30",
    category: "Meetup",
    link: "https://lu.ma/example-brunch",
  },
  {
    id: "mock-5",
    name: "Demo Day: Spring Cohort",
    where: "Samsung 837, Meatpacking",
    date: isoOffset(2),
    time: "17:00",
    category: "Demo",
    link: "https://example.com/demo-day",
  },
  {
    id: "mock-6",
    name: "VC Speed Networking",
    where: "Foursquare HQ, New York, NY",
    date: isoOffset(3),
    time: "18:00",
    category: "Mixer",
    link: "https://lu.ma/example-vc-speed",
  },
  {
    id: "mock-7",
    name: "Hardware Hack Showcase",
    where: "NYU Tandon, Brooklyn, NY",
    date: isoOffset(4),
    time: "14:00",
    category: "Demo",
    link: "https://example.com/hw-hack",
  },
  {
    id: "mock-8",
    name: "Pitch Night: Climate",
    where: "Greenlight Capital, New York, NY",
    date: isoOffset(5),
    time: "19:00",
    category: "Pitch",
    link: "https://lu.ma/example-pitch-climate",
  },
  {
    id: "mock-9",
    name: "Saturday Founders Hike",
    where: "Prospect Park, Brooklyn, NY",
    date: isoOffset(6),
    time: "09:30",
    category: "Meetup",
    link: "https://example.com/hike",
  },
  {
    id: "mock-10",
    name: "Pre-Seed Workshop",
    where: "Techstars, New York, NY",
    date: isoOffset(7),
    time: "13:00",
    category: "Workshop",
    link: "https://example.com/preseed",
  },
  {
    id: "mock-11",
    name: "Fintech Founders Mixer",
    where: "Bloomberg HQ, New York, NY",
    date: isoOffset(8),
    time: "18:30",
    category: "Mixer",
    link: "https://lu.ma/example-fintech-mixer",
  },
  {
    id: "mock-12",
    name: "Open Mic Pitch",
    where: "Bessemer, New York, NY",
    date: isoOffset(9),
    time: "17:30",
    category: "Pitch",
    link: "https://example.com/open-mic",
  },
];

/** Human label for a date relative to today. */
function dayLabel(iso: string): string {
  const n = Math.round(
    (Date.parse(iso + "T00:00:00") - Date.parse(todayIso() + "T00:00:00")) /
      86_400_000,
  );
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 1 && n < 7) return `In ${n} days`;
  return iso;
}

function matches(
  e: MockEvent,
  description: string,
  location: string,
  from: string,
  to: string,
) {
  const q = description.trim().toLowerCase();
  const loc = location.trim().toLowerCase();
  const haystack = `${e.name} ${e.category} ${e.where}`.toLowerCase();
  if (q && !haystack.includes(q)) return false;
  if (loc && !e.where.toLowerCase().includes(loc)) return false;
  if (from && e.date < from) return false;
  if (to && e.date > to) return false;
  return true;
}

export function EventFinder() {
  const list = EventsList.useList();
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState<MockEvent[] | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const filtered = MOCK_EVENTS.filter((m) =>
      matches(m, description, location, from, to),
    ).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    setResults(filtered);
  }

  function onReset() {
    setLocation("");
    setDescription("");
    setFrom("");
    setTo("");
    setResults(null);
    setAdded({});
  }

  /** Group consecutive results by ISO date, in order. */
  const grouped = useMemo(() => {
    if (!results) return [];
    const out: { date: string; items: MockEvent[] }[] = [];
    for (const ev of results) {
      const last = out[out.length - 1];
      if (last && last.date === ev.date) {
        last.items.push(ev);
      } else {
        out.push({ date: ev.date, items: [ev] });
      }
    }
    return out;
  }, [results]);

  function quickAdd(ev: MockEvent) {
    if (added[ev.id]) return;
    setAdded((a) => ({ ...a, [ev.id]: true }));
    const optimistic = {
      id: `optimistic-${ev.id}`,
      name: ev.name,
      when: formatWhen(ev.date),
      date: ev.date,
      where: ev.where,
      metIds: [],
      metGuests: [],
      note: "",
      upcoming: true,
      avatarTone: "slate" as const,
      rank: -1,
    };
    list.add(optimistic, () =>
      createEvent({ name: ev.name, eventDate: ev.date, location: ev.where }),
    );
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <span className="eyebrow">Find events</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        onSubmit={onSearch}
        className="grid grid-cols-1 gap-2 rounded-md border border-border bg-card p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-center"
      >
        <div className="relative">
          <Icons.pin className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="h-9 pl-8"
            aria-label="Location"
          />
        </div>
        <div className="relative">
          <Icons.search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Search events (mixers, demo days, workshops…)"
            className="h-9 pl-8"
            aria-label="Event description"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1">
            <Icons.calendar className="size-4 text-muted-foreground" />
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-7 w-34 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
              aria-label="From date"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="h-7 w-34 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
              aria-label="To date"
            />
          </div>
          <Button type="submit" size="sm" className="h-9 px-3">
            <Icons.search className="size-4" /> Search
          </Button>
          {results ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-9 px-2 text-muted-foreground"
            >
              <Icons.x className="size-4" /> Clear
            </Button>
          ) : null}
        </div>
      </form>

      {results ? (
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 pl-4 font-heading text-[11px] tracking-wider uppercase">
                  Event
                </TableHead>
                <TableHead className="h-9 font-heading text-[11px] tracking-wider uppercase">
                  Where
                </TableHead>
                <TableHead className="h-9 font-heading text-[11px] tracking-wider uppercase">
                  When
                </TableHead>
                <TableHead className="h-9 w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No events match that search.
                  </TableCell>
                </TableRow>
              ) : (
                grouped.map((g) => (
                  <Fragment key={g.date}>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="bg-muted/40 py-1.5 pl-4">
                        <span className="eyebrow text-muted-foreground">
                          {dayLabel(g.date)}
                        </span>
                      </TableCell>
                    </TableRow>
                    {g.items.map((ev) => (
                      <TableRow key={ev.id} className="hover:bg-muted/50">
                        <TableCell className="py-2 pl-4">
                          <div className="flex items-center gap-2.5">
                            <InitialsAvatar
                              name={ev.name}
                              tone="blue"
                              className="size-7 text-[10px]"
                            />
                            <span className="font-medium">{ev.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ev.where}
                        </TableCell>
                        <TableCell>
                          <span className="tabular-nums text-muted-foreground">
                            {ev.time}
                          </span>
                        </TableCell>
                        <TableCell className="pr-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={ev.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              aria-label={`Open ${ev.name} page`}
                            >
                              <Icons.arrowUpRight className="size-3.5" /> Page
                            </a>
                            <Button
                              size="icon-sm"
                              variant={added[ev.id] ? "secondary" : "default"}
                              disabled={added[ev.id]}
                              onClick={() => quickAdd(ev)}
                              aria-label={
                                added[ev.id]
                                  ? `Added ${ev.name}`
                                  : `Add ${ev.name} to your events`
                              }
                              title={
                                added[ev.id]
                                  ? "Added to your events"
                                  : "Add to your events"
                              }
                            >
                              {added[ev.id] ? (
                                <Icons.check className="size-4" />
                              ) : (
                                <Icons.plus className="size-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className={cn("px-1 text-xs text-muted-foreground")}>
        </p>
      )}
    </section>
  );
}
