"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import type { EventItem } from "@/lib/data";
import { connectionsById } from "@/lib/data";
import { toneInk } from "@/lib/tone";
import { InitialsAvatar, AvatarStack, StatusBadge } from "@/components/app/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EventPanel } from "@/components/app/event-panel";

/** People met at an event, resolved to their connection (guests kept as names). */
export function metPeople(event: EventItem) {
  const connections = event.metIds
    .map((id) => connectionsById[id])
    .filter(Boolean)
    .map((c) => ({ name: c.name, tone: c.avatarTone }));
  const guests = (event.metGuests ?? []).map((name) => ({
    name,
    tone: "slate" as const,
  }));
  return [...connections, ...guests];
}

export function EventsView({
  events,
  showControls = false,
}: {
  events: EventItem[];
  showControls?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      const matchesQuery =
        !q ||
        [e.name, e.where, ...e.organizers].some((f) =>
          f.toLowerCase().includes(q),
        );
      const matchesWhen =
        when === "all" ||
        (when === "upcoming" ? e.upcoming : !e.upcoming);
      return matchesQuery && matchesWhen;
    });
  }, [events, query, when]);

  const selected = events.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {showControls ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-56 flex-1">
            <Icons.search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, place, or organizer…"
              className="h-9 pl-8"
            />
          </div>
          <Select value={when} onValueChange={setWhen}>
            <SelectTrigger className="h-9 w-40">
              <Icons.filter className="size-4 text-muted-foreground" />
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent position="popper" align="end" className="min-w-40">
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "event" : "events"}
          </span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 pl-4 font-heading text-[11px] tracking-wider uppercase">
                Event
              </TableHead>
              <TableHead className="h-9 font-heading text-[11px] tracking-wider uppercase">
                When
              </TableHead>
              <TableHead className="h-9 font-heading text-[11px] tracking-wider uppercase">
                Where
              </TableHead>
              <TableHead className="h-9 font-heading text-[11px] tracking-wider uppercase">
                Met
              </TableHead>
              <TableHead className="h-9 w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => {
              const met = metPeople(e);
              return (
                <TableRow
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className="cursor-pointer"
                >
                  <TableCell className="py-2 pl-4">
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar name={e.name} tone={e.avatarTone} />
                      <span className="font-medium">{e.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={e.upcoming ? "Upcoming" : "Past"}
                        tone={e.upcoming ? "blue" : "slate"}
                      />
                      <span className="tabular-nums text-muted-foreground">
                        {e.when}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.where}
                  </TableCell>
                  <TableCell>
                    {met.length > 0 ? (
                      <AvatarStack people={met} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-2">
                    <RowActions />
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No events match your search.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <EventPanel
        event={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
    </div>
  );
}

/** Frequently-used actions promoted to the row; the rest live in the menu. */
function RowActions() {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div className="flex items-center justify-end gap-0.5 text-muted-foreground">
      <IconAction icon={Icons.calendar} label="Add to calendar" onClick={stop} />
      <IconAction icon={Icons.edit} label="Edit" onClick={stop} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={stop}
            aria-label="More actions"
          >
            <Icons.dots className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop}>
          <DropdownMenuItem
            className={cn("focus:bg-destructive/10", toneInk.red)}
          >
            <Icons.x className="size-4" /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: (typeof Icons)[keyof typeof Icons];
  label: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={label}>
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
