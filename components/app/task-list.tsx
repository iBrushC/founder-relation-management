"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import type { Task } from "@/lib/data";
import { formatMonthDay, monthDayToIso } from "@/lib/data/format";
import {
  createTask,
  removeTask,
  toggleTask,
  updateSubtasks,
  updateTask,
} from "@/lib/data/actions";
import { popProps, useReactiveList } from "@/components/app/reactive-list";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Year used to round-trip a task's `"Mon D"` due label through a date input. */
const DUE_YEAR = new Date().getFullYear();

/** Draft fields shared by the add row and per-task edit form. */
type Draft = { label: string; due: string; description: string };

const EMPTY_DRAFT: Draft = { label: "", due: "", description: "" };

function draftFromTask(t: Task): Draft {
  return {
    label: t.label,
    due: t.due ? monthDayToIso(t.due, DUE_YEAR) ?? "" : "",
    description: t.description ?? "",
  };
}

export function TaskList({
  tasks,
  projectId,
}: {
  tasks: Task[];
  projectId?: string;
}) {
  // Tasks flow through the shared optimistic list: mutations apply instantly,
  // pop in/out, and auto-revert with a toast if their server action fails.
  const list = useReactiveList<Task>(tasks);
  const items = list.items;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);

  const toggle = (id: string) => {
    const task = items.find((t) => t.id === id);
    if (!task) return;
    const done = !task.done;
    list.update({ ...task, done }, () => toggleTask(id, done, projectId));
  };

  const toggleSubtask = (taskId: string, subId: string) => {
    const task = items.find((t) => t.id === taskId);
    const updated = task?.subtasks?.map((s) =>
      s.id === subId ? { ...s, done: !s.done } : s,
    );
    if (!task || !updated) return;
    list.update({ ...task, subtasks: updated }, () =>
      updateSubtasks(taskId, updated, projectId),
    );
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startEdit = (task: Task) => {
    setDraft(draftFromTask(task));
    setEditingId(task.id);
  };

  const saveEdit = (id: string) => {
    const label = draft.label.trim();
    if (!label) return;
    const task = items.find((t) => t.id === id);
    if (!task) return;
    const dueLabel = draft.due ? formatMonthDay(draft.due) : undefined;
    list.update(
      {
        ...task,
        label,
        due: dueLabel,
        description: draft.description.trim() || undefined,
      },
      () =>
        updateTask(
          id,
          { label, dueDate: draft.due || null, description: draft.description },
          projectId,
        ),
    );
    setEditingId(null);
  };

  const remove = (id: string) => {
    list.remove(id, () => removeTask(id, projectId));
  };

  const addTask = () => {
    const label = draft.label.trim();
    if (!label) return;
    const dueLabel = draft.due ? formatMonthDay(draft.due) : undefined;
    const optimistic: Task = {
      id: `optimistic-${crypto.randomUUID()}`,
      label,
      done: false,
      due: dueLabel,
      description: draft.description.trim() || undefined,
      subtasks: [],
    };
    list.add(optimistic, () =>
      createTask(projectId ?? "", {
        label,
        dueDate: draft.due || null,
        description: draft.description,
      }),
    );
    setDraft(EMPTY_DRAFT);
    setAdding(false);
  };

  const openCount = items.filter((t) => !t.done).length;
  // Render in list order (newest first). Completing a task leaves it in place —
  // we deliberately don't re-sort done tasks to the bottom.
  const ordered = items;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-xs tabular-nums text-muted-foreground">
          {openCount} open · {items.length - openCount} done
        </span>
        {projectId ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setAdding((a) => !a);
              setEditingId(null);
            }}
          >
            <Icons.plus className="size-3.5" /> Add task
          </Button>
        ) : null}
      </div>

      {adding ? (
        <DraftForm
          draft={draft}
          setDraft={setDraft}
          onSubmit={addTask}
          onCancel={() => setAdding(false)}
          submitLabel="Add"
        />
      ) : null}

      <ul className="divide-y divide-border">
        {ordered.map((task) => {
          const hasDetail =
            Boolean(task.description) || Boolean(task.subtasks?.length);
          const isOpen = expanded.has(task.id);
          const isEditing = editingId === task.id;
          const subDone = task.subtasks?.filter((s) => s.done).length ?? 0;
          const subTotal = task.subtasks?.length ?? 0;

          if (isEditing) {
            return (
              <li key={task.id}>
                <DraftForm
                  draft={draft}
                  setDraft={setDraft}
                  onSubmit={() => saveEdit(task.id)}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save"
                />
              </li>
            );
          }

          const pop = popProps(list, task.id);
          return (
            <li
              key={task.id}
              onAnimationEnd={pop.onAnimationEnd}
              className={pop.className}
            >
              <div className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50">
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

                {projectId ? (
                  <div className="flex items-center gap-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEdit(task)}
                      aria-label="Edit task"
                    >
                      <Icons.edit className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(task.id)}
                      aria-label="Delete task"
                    >
                      <Icons.x className="size-4" />
                    </Button>
                  </div>
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
                                s.done && "text-muted-foreground line-through",
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

        {ordered.length === 0 && !adding ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            No tasks yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** The shared label/due/description editor for adding and editing a task. */
function DraftForm({
  draft,
  setDraft,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.label.trim()) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Task…"
          className="h-8"
        />
        <Input
          type="date"
          value={draft.due}
          onChange={(e) => setDraft((d) => ({ ...d, due: e.target.value }))}
          className="h-8 w-40"
          aria-label="Due date"
        />
      </div>
      <Textarea
        value={draft.description}
        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        placeholder="Description (optional)…"
        className="min-h-14"
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={!draft.label.trim()} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
