"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import type { Connection, EventItem } from "@/lib/data";
import { removeEvent } from "@/lib/data/actions";
import { popProps, staticList } from "@/components/app/reactive-list";
import { EventsList } from "@/components/app/list-contexts";
import { InitialsAvatar, AvatarStack, StatusBadge } from "@/components/app/primitives";
import { RowActions } from "@/components/app/row-actions";
import { ListToolbar } from "@/components/app/list-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventPanel } from "@/components/app/event-panel";

/** People met at an event, resolved to their connection (guests kept as names). */
export function metPeople(
  event: EventItem,
  connectionsById: Record<string, Connection>,
) {
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
  connectionsById,
  showControls = false,
}: {
  /** Static rows for surfaces without a list provider. */
  events?: EventItem[];
  connectionsById: Record<string, Connection>;
  showControls?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intent, setIntent] = useState<"view" | "edit">("view");

  const openPanel = (id: string, next: "view" | "edit") => {
    setIntent(next);
    setSelectedId(id);
  };

  // Use the page's optimistic list when present; otherwise render props statically.
  const list = EventsList.useOptional() ?? staticList(events ?? []);
  const rows = list.items;

  // Deep link from global search: `/events?focus=<id>` opens that event.
  // Adjusted during render (React's recommended alternative to an effect).
  const searchParams = useSearchParams();
  const focus = showControls ? searchParams.get("focus") : null;
  const [prevFocus, setPrevFocus] = useState<string | null>(null);
  if (focus !== prevFocus) {
    setPrevFocus(focus);
    if (focus && rows.some((e) => e.id === focus)) {
      setIntent("view");
      setSelectedId(focus);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((e) => {
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
  }, [rows, query, when]);

  const selected = rows.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {showControls ? (
        <ListToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search by name, place, or organizer…"
          filter={
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
          }
          count={`${filtered.length} ${filtered.length === 1 ? "event" : "events"}`}
        />
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
              const met = metPeople(e, connectionsById);
              const pop = popProps(list, e.id);
              return (
                <TableRow
                  key={e.id}
                  onClick={pop.exiting ? undefined : () => openPanel(e.id, "view")}
                  onAnimationEnd={pop.onAnimationEnd}
                  className={cn("cursor-pointer", pop.className)}
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
                    <RowActions
                      actions={[
                        { icon: Icons.calendar, label: "Add to calendar" },
                        {
                          icon: Icons.edit,
                          label: "Edit",
                          onClick: () => openPanel(e.id, "edit"),
                        },
                      ]}
                      onRemove={() => list.remove(e.id, () => removeEvent(e.id))}
                    />
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
        connectionsById={connectionsById}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelectedId(null)}
        initialEditing={intent === "edit"}
      />
    </div>
  );
}

