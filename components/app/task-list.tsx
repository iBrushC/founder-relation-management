"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import type { Task } from "@/lib/data";
import { toggleTask, updateSubtasks } from "@/lib/data/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export function TaskList({
  tasks,
  projectId,
}: {
  tasks: Task[];
  projectId?: string;
}) {
  const [items, setItems] = useState(tasks);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Optimistically flip the checkbox, then persist. Server state is authoritative
  // on the next load; revalidation keeps other views in sync.
  const toggle = (id: string) => {
    const next = !items.find((t) => t.id === id)?.done;
    setItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: next } : t)),
    );
    startTransition(() => toggleTask(id, next, projectId));
  };

  const toggleSubtask = (taskId: string, subId: string) => {
    let updated: Task["subtasks"];
    setItems((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        updated = t.subtasks?.map((s) =>
          s.id === subId ? { ...s, done: !s.done } : s,
        );
        return { ...t, subtasks: updated };
      }),
    );
    if (updated) {
      startTransition(() => updateSubtasks(taskId, updated!, projectId));
    }
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openCount = items.filter((t) => !t.done).length;
  // Keep open tasks on top, completed sink to the bottom (stable within groups).
  const ordered = [...items].sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-xs tabular-nums text-muted-foreground">
          {openCount} open · {items.length - openCount} done
        </span>
      </div>
      <ul className="divide-y divide-border">
        {ordered.map((task) => {
          const hasDetail =
            Boolean(task.description) || Boolean(task.subtasks?.length);
          const isOpen = expanded.has(task.id);
          const subDone = task.subtasks?.filter((s) => s.done).length ?? 0;
          const subTotal = task.subtasks?.length ?? 0;

          return (
            <li key={task.id}>
              <div className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50">
                <Checkbox
                  checked={task.done}
                  onCheckedChange={() => toggle(task.id)}
                  aria-label={task.label}
                />
                <span
                  onClick={() => toggle(task.id)}
                  className={cn(
                    "flex-1 cursor-pointer text-sm",
                    task.done && "text-muted-foreground line-through",
                  )}
                >
                  {task.label}
                </span>

                {subTotal > 0 ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {subDone}/{subTotal}
                  </span>
                ) : null}

                {task.due && !task.done ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {task.due}
                  </span>
                ) : null}

                {hasDetail ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => toggleExpanded(task.id)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Hide details" : "Show details"}
                    className={cn(
                      isOpen ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <Icons.message className="size-4" />
                  </Button>
                ) : null}
              </div>

              {hasDetail && isOpen ? (
                <div className="flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-3 pl-11">
                  {task.description ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}
                  {task.subtasks?.length ? (
                    <ul className="flex flex-col gap-1.5">
                      {task.subtasks.map((s) => (
                        <li key={s.id}>
                          <label className="flex cursor-pointer items-center gap-2.5">
                            <Checkbox
                              checked={s.done}
                              onCheckedChange={() =>
                                toggleSubtask(task.id, s.id)
                              }
                            />
                            <span
                              className={cn(
                                "text-sm",
                                s.done &&
                                  "text-muted-foreground line-through",
                              )}
                            >
                              {s.label}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
