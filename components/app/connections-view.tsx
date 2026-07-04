"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import type { Connection } from "@/lib/data";
import { removeConnection } from "@/lib/data/actions";
import { toneInk } from "@/lib/tone";
import { popProps, staticList } from "@/components/app/reactive-list";
import { ConnectionsList } from "@/components/app/list-contexts";
import { Tag, InitialsAvatar } from "@/components/app/primitives";
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
import { ConnectionPanel } from "@/components/app/connection-panel";

export function ConnectionsView({
  connections,
  showControls = false,
}: {
  /** Static rows for surfaces without a list provider (e.g. a project's people). */
  connections?: Connection[];
  showControls?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intent, setIntent] = useState<"view" | "edit" | "log">("view");

  const openPanel = (id: string, next: "view" | "edit" | "log") => {
    setIntent(next);
    setSelectedId(id);
  };

  // Use the page's optimistic list when present; otherwise render the props statically.
  const list = ConnectionsList.useOptional() ?? staticList(connections ?? []);
  const rows = list.items;

  const allTags = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((c) => c.tags.forEach((t) => set.add(t.label)));
    return Array.from(set).sort();
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

  return (
    <div className="flex flex-col gap-4">
      {showControls ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-56 flex-1">
            <Icons.search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, role, or company…"
              className="h-9 pl-8"
            />
          </div>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="h-9 w-40">
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
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "person" : "people"}
          </span>
        </div>
      ) : null}

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
            {filtered.map((c) => {
              const pop = popProps(list, c.id);
              return (
              <TableRow
                key={c.id}
                onClick={pop.exiting ? undefined : () => openPanel(c.id, "view")}
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
                    onEdit={() => openPanel(c.id, "edit")}
                    onLog={() => openPanel(c.id, "log")}
                    onRemove={() =>
                      list.remove(c.id, () => removeConnection(c.id))
                    }
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
                  No connections match your search.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <ConnectionPanel
        connection={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelectedId(null)}
        initialEditing={intent === "edit"}
        initialLogOpen={intent === "log"}
      />
    </div>
  );
}

/** Frequently-used actions promoted to the row; the rest live in the menu. */
function RowActions({
  onEdit,
  onLog,
  onRemove,
}: {
  onEdit: () => void;
  onLog: () => void;
  onRemove: () => void;
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const handle = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div className="flex items-center justify-end gap-0.5 text-muted-foreground">
      <IconAction
        icon={Icons.message}
        label="Log interaction"
        onClick={handle(onLog)}
      />
      <IconAction icon={Icons.edit} label="Edit" onClick={handle(onEdit)} />
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
            onSelect={onRemove}
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
