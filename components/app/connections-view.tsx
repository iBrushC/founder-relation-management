"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import type { Connection, Interaction, Tag as TagType } from "@/lib/data";
import { logInteraction, removeConnection } from "@/lib/data/actions";
import {
  popProps,
  staticList,
  type ReactiveList,
} from "@/components/app/reactive-list";
import { ConnectionsList } from "@/components/app/list-contexts";
import { Tag, InitialsAvatar } from "@/components/app/primitives";
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
import {
  ConnectionPanel,
  ConnectionDetailInline,
  type ProjectLink,
} from "@/components/app/connection-panel";
import { LogInteractionDialog } from "@/components/app/log-interaction-dialog";

export function ConnectionsView({
  connections,
  connectionProjects = {},
  showControls = false,
}: {
  /** Static rows for surfaces without a list provider (e.g. a project's people). */
  connections?: Connection[];
  /** Projects each connection is linked to, keyed by connection id. */
  connectionProjects?: Record<string, ProjectLink[]>;
  showControls?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intent, setIntent] = useState<"view" | "edit">("view");
  // The connection whose "Log interaction" dialog is open (null = closed).
  const [logId, setLogId] = useState<string | null>(null);

  // The full Connections page shows the detail inline (in-page); other surfaces
  // (e.g. the dashboard section) keep the overlay sheet.
  const inlineDetail = showControls;

  const openPanel = (id: string, next: "view" | "edit") => {
    setIntent(next);
    setSelectedId(id);
  };

  // Use the page's optimistic list when present; otherwise render the props statically.
  const list = ConnectionsList.useOptional() ?? staticList(connections ?? []);
  const rows = list.items;

  // Deep link from global search: `/connections?focus=<id>` opens that person.
  // Adjusted during render (React's recommended alternative to an effect):
  // when the focused id changes, open its panel — a fresh search opens the new
  // person, while closing the panel on the same id isn't undone by re-renders.
  const searchParams = useSearchParams();
  const focus = showControls ? searchParams.get("focus") : null;
  const [prevFocus, setPrevFocus] = useState<string | null>(null);
  if (focus !== prevFocus) {
    setPrevFocus(focus);
    if (focus && rows.some((c) => c.id === focus)) {
      setIntent("view");
      setSelectedId(focus);
    }
  }

  const allTags = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((c) => c.tags.forEach((t) => set.add(t.label)));
    return Array.from(set).sort();
  }, [rows]);

  // Distinct tags across everyone, offered as one-click picks in the editor.
  const tagSuggestions = useMemo(() => {
    const byLabel = new Map<string, TagType>();
    rows.forEach((c) =>
      c.tags.forEach((t) => {
        if (!byLabel.has(t.label.toLowerCase())) byLabel.set(t.label.toLowerCase(), t);
      }),
    );
    return Array.from(byLabel.values());
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => {
      const matchesQuery =
        !q ||
        [c.name, c.role, c.company].some((f) => f.toLowerCase().includes(q));
      const matchesTag = tag === "all" || c.tags.some((t) => t.label === tag);
      return matchesQuery && matchesTag;
    });
  }, [rows, query, tag]);

  const selected = rows.find((c) => c.id === selectedId) ?? null;
  const collapsed = inlineDetail && selected !== null;

  const logTarget = rows.find((c) => c.id === logId) ?? null;

  // Prepend a logged interaction to the target, optimistically through the list.
  const handleLog = (entry: Interaction) => {
    if (!logTarget) return;
    const next: Connection = {
      ...logTarget,
      timeline: [entry, ...logTarget.timeline],
      last: entry.when,
    };
    list.update(next, () => logInteraction(logTarget.id, entry));
    setLogId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {showControls ? (
        <ListToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search by name, role, or company…"
          filter={
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger className="h-9 w-40 data-[size=default]:h-9">
                <Icons.filter className="size-4 text-muted-foreground" />
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent position="popper" align="end" className="min-w-40">
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          count={`${filtered.length} ${filtered.length === 1 ? "person" : "people"}`}
        />
      ) : null}

      <div className="flex items-start gap-4">
        <div className={cn("min-w-0", collapsed ? "w-64 shrink-0" : "flex-1")}>
          {collapsed ? (
            <CompactList
              rows={filtered}
              list={list}
              selectedId={selectedId}
              onSelect={(id) => openPanel(id, "view")}
            />
          ) : (
            <FullTable
              rows={filtered}
              list={list}
              onOpen={openPanel}
              onLog={setLogId}
            />
          )}
        </div>

        {collapsed && selected ? (
          <div className="sticky top-3 min-w-0 flex-1 self-start">
            <ConnectionDetailInline
              connection={selected}
              projects={connectionProjects[selected.id] ?? []}
              tagSuggestions={tagSuggestions}
              initialEditing={intent === "edit"}
              onClose={() => setSelectedId(null)}
            />
          </div>
        ) : null}
      </div>

      {!inlineDetail ? (
        <ConnectionPanel
          connection={selected}
          projects={selected ? connectionProjects[selected.id] ?? [] : []}
          tagSuggestions={tagSuggestions}
          open={selected !== null}
          onOpenChange={(o) => !o && setSelectedId(null)}
          initialEditing={intent === "edit"}
        />
      ) : null}

      <LogInteractionDialog
        connectionName={logTarget?.name}
        open={logTarget !== null}
        onOpenChange={(o) => !o && setLogId(null)}
        onSubmit={handleLog}
      />
    </div>
  );
}

/** The full connections table — name, role, tags, last contact, and row actions. */
function FullTable({
  rows,
  list,
  onOpen,
  onLog,
}: {
  rows: Connection[];
  list: ReactiveList<Connection>;
  onOpen: (id: string, intent: "view" | "edit") => void;
  onLog: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 pl-4 font-heading text-[11px] tracking-wider uppercase">
              Name
            </TableHead>
            <TableHead className="h-9 font-heading text-[11px] tracking-wider uppercase">
              Role
            </TableHead>
            <TableHead className="h-9 font-heading text-[11px] tracking-wider uppercase">
              Tags
            </TableHead>
            <TableHead className="h-9 font-heading text-[11px] tracking-wider uppercase">
              Last
            </TableHead>
            <TableHead className="h-9 w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const pop = popProps(list, c.id);
            return (
              <TableRow
                key={c.id}
                onClick={pop.exiting ? undefined : () => onOpen(c.id, "view")}
                onAnimationEnd={pop.onAnimationEnd}
                className={cn("cursor-pointer", pop.className)}
              >
                <TableCell className="py-2 pl-4">
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={c.name} tone={c.avatarTone} />
                    <span className="font-medium">{c.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.role} · {c.company}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {c.tags.map((t) => (
                      <Tag key={t.label} {...t} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                  {c.last}
                </TableCell>
                <TableCell className="pr-2">
                  <RowActions
                    actions={[
                      {
                        icon: Icons.message,
                        label: "Log interaction",
                        onClick: () => onLog(c.id),
                      },
                      {
                        icon: Icons.edit,
                        label: "Edit",
                        onClick: () => onOpen(c.id, "edit"),
                      },
                    ]}
                    onRemove={() =>
                      list.remove(c.id, () => removeConnection(c.id))
                    }
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={5}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No connections match your search.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

/** The narrowed list shown beside the inline detail — avatar + name only. */
function CompactList({
  rows,
  list,
  selectedId,
  onSelect,
}: {
  rows: Connection[];
  list: ReactiveList<Connection>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <ul className="flex flex-col">
        {rows.map((c) => {
          const pop = popProps(list, c.id);
          const active = c.id === selectedId;
          return (
            <li
              key={c.id}
              onAnimationEnd={pop.onAnimationEnd}
              className={cn("border-b border-border last:border-b-0", pop.className)}
            >
              <button
                type="button"
                onClick={pop.exiting ? undefined : () => onSelect(c.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors",
                  active ? "bg-accent" : "hover:bg-muted/60",
                )}
              >
                <InitialsAvatar name={c.name} tone={c.avatarTone} />
                <span className="truncate text-sm font-medium">{c.name}</span>
              </button>
            </li>
          );
        })}
        {rows.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">
            No matches.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

