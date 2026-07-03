"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/data";
import { Checkbox } from "@/components/ui/checkbox";

export function TaskList({ tasks }: { tasks: Task[] }) {
  const [items, setItems] = useState(tasks);

  const toggle = (id: string) =>
    setItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );

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
        {ordered.map((task) => (
          <li key={task.id}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40">
              <Checkbox
                checked={task.done}
                onCheckedChange={() => toggle(task.id)}
              />
              <span
                className={cn(
                  "flex-1 text-sm",
                  task.done && "text-muted-foreground line-through",
                )}
              >
                {task.label}
              </span>
              {task.due && !task.done ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {task.due}
                </span>
              ) : null}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
