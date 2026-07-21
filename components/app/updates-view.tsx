"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { toneBg } from "@/lib/tone";
import type { Connection, Project, Update } from "@/lib/data";
import { dayBucket, type DayBucket } from "@/lib/data/format";
import { InitialsAvatar, Tag } from "@/components/app/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

// The three day-windows we surface, in the order they render.
const GROUPS: { key: Exclude<DayBucket, "other">; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "yesterday", label: "Yesterday" },
];

/**
 * Server action signature the panel calls to clear a recurring check-in
 * reminder (so it doesn't surface every day). Injected by the dashboard.
 * Passed as a prop rather than imported directly so the panel stays free of
 * server-action wiring details — it only sees `(id) => Promise<unknown>`.
 */
type AcknowledgeCheckIn = (connectionId: string) => Promise<unknown>;

export function UpdatesView({
  updates,
  connectionsById,
  projectsById,
  acknowledgeCheckIn,
}: {
  updates: Update[];
  connectionsById: Record<string, Connection>;
  projectsById: Record<string, Project>;
  acknowledgeCheckIn: AcknowledgeCheckIn;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = updates.find((u) => u.id === selectedId) ?? null;

  // Bucket once, keep only the groups that have something to show.
  const grouped = GROUPS.map((g) => ({
    ...g,
    items: updates.filter((u) => dayBucket(u.date) === g.key),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 pl-4 font-heading text-[11px] tracking-wider uppercase">
                Update
              </TableHead>
              <TableHead className="h-9 font-heading text-[11px] tracking-wider uppercase">
                Kind
              </TableHead>
              <TableHead className="h-9 w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nothing for today, tomorrow, or yesterday.
                </TableCell>
              </TableRow>
            ) : (
              grouped.map((group) => (
                <Fragment key={group.key}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="bg-muted/40 py-1.5 pl-4">
                      <span className="eyebrow text-muted-foreground">
                        {group.label}
                      </span>
                    </TableCell>
                  </TableRow>
                  {group.items.map((u) => {
                    const Icon = Icons[u.icon];
                    return (
                      <TableRow
                        key={u.id}
                        onClick={() => setSelectedId(u.id)}
                        className="cursor-pointer"
                      >
                        <TableCell className="py-2 pl-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "grid size-8 shrink-0 place-items-center rounded-md",
                                toneBg[u.tone],
                              )}
                            >
                              <Icon className="size-4" />
                            </span>
                            <span className="font-medium">{u.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Tag label={u.kind} tone={u.tone} />
                        </TableCell>
                        <TableCell className="pr-3 text-right">
                          <Icons.chevronRight className="inline size-4 text-muted-foreground/60" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <UpdatePanel
        update={selected}
        connectionsById={connectionsById}
        projectsById={projectsById}
        acknowledgeCheckIn={acknowledgeCheckIn}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
    </>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="eyebrow">{title}</span>
      {children}
    </div>
  );
}

function UpdatePanel({
  update,
  connectionsById,
  projectsById,
  acknowledgeCheckIn,
  open,
  onOpenChange,
}: {
  update: Update | null;
  connectionsById: Record<string, Connection>;
  projectsById: Record<string, Project>;
  acknowledgeCheckIn: AcknowledgeCheckIn;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const Icon = update ? Icons[update.icon] : Icons.flag;
  const people = update
    ? update.connectionIds.map((id) => connectionsById[id]).filter(Boolean)
    : [];
  const relatedProjects = update
    ? update.projectIds.map((id) => projectsById[id]).filter(Boolean)
    : [];

  // Check-in rows carry `check_in:<connectionId>` as their id; everything else
  // is non-recurring and gets no acknowledge button.
  const isCheckIn = !!update && update.id.startsWith("check_in:");
  const checkInConnectionId = isCheckIn ? update!.id.slice("check_in:".length) : null;
  const [acking, startAcking] = useTransition();
  function handleAcknowledge() {
    if (!checkInConnectionId) return;
    startAcking(async () => {
      await acknowledgeCheckIn(checkInConnectionId);
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] gap-0 p-0 sm:max-w-[380px]">
        {update ? (
          <>
            <SheetHeader className="gap-3 border-b border-border p-5">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-md",
                    toneBg[update.tone],
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="font-sans text-base font-semibold">
                    {update.title}
                  </SheetTitle>
                  <SheetDescription>
                    {update.kind} · {update.when}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
              <Block title="Details">
                <p className="text-sm leading-relaxed text-foreground/90">
                  {update.detail}
                </p>
              </Block>

              {people.length ? (
                <Block title="People">
                  <div className="flex flex-col gap-1">
                    {people.map((c) => (
                      <Link
                        key={c.id}
                        href="/connections"
                        className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted/50"
                      >
                        <InitialsAvatar name={c.name} tone={c.avatarTone} />
                        <div className="min-w-0 leading-tight">
                          <div className="truncate text-sm font-medium">
                            {c.name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {c.role} · {c.company}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </Block>
              ) : null}

              {relatedProjects.length ? (
                <Block title="Projects">
                  <div className="flex flex-col gap-1">
                    {relatedProjects.map((p) => {
                      const PIcon = Icons[p.icon];
                      return (
                        <Link
                          key={p.id}
                          href={`/projects/${p.id}`}
                          className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted/50"
                        >
                          <span
                            className={cn(
                              "grid size-8 shrink-0 place-items-center rounded-md",
                              toneBg[p.tone],
                            )}
                          >
                            <PIcon className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1 leading-tight">
                            <div className="truncate text-sm font-medium">
                              {p.name}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {p.summary}
                            </div>
                          </div>
                          <Tag label={p.status.label} tone={p.status.tone} />
                        </Link>
                      );
                    })}
                  </div>
                </Block>
              ) : null}

              {isCheckIn ? (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAcknowledge}
                    disabled={acking}
                  >
                    <Icons.check className="size-3.5" />
                    {acking ? "Saving…" : "Mark done"}
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
