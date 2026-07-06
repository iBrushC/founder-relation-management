"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { toneBg } from "@/lib/tone";
import type { Connection, Project, Update } from "@/lib/data";
import { UpdateRow } from "@/components/app/rows";
import { InitialsAvatar, Tag } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const PAGE_SIZE = 5;

export function UpdatesView({
  updates,
  connectionsById,
  projectsById,
}: {
  updates: Update[];
  connectionsById: Record<string, Connection>;
  projectsById: Record<string, Project>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const selected = updates.find((u) => u.id === selectedId) ?? null;

  const pageCount = Math.max(1, Math.ceil(updates.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  const visible = updates.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((u) => (
        <UpdateRow key={u.id} update={u} onClick={() => setSelectedId(u.id)} />
      ))}

      {updates.length > PAGE_SIZE ? (
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {start + 1}–{Math.min(start + PAGE_SIZE, updates.length)} of{" "}
            {updates.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <Icons.chevronRight className="size-3.5 rotate-180" />
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
              <Icons.chevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      <UpdatePanel
        update={selected}
        connectionsById={connectionsById}
        projectsById={projectsById}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
    </div>
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
  open,
  onOpenChange,
}: {
  update: Update | null;
  connectionsById: Record<string, Connection>;
  projectsById: Record<string, Project>;
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
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
