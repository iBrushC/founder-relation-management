"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icons, type IconKey } from "@/lib/icons";
import { toneBg } from "@/lib/tone";
import type { Connection, Project, Tone } from "@/lib/data";
import {
  linkParticipant,
  removeProject,
  unlinkParticipant,
  updateProject,
} from "@/lib/data/actions";
import { useRouter } from "next/navigation";
import { PageBody, Section } from "@/components/app/layout-bits";
import { TaskList } from "@/components/app/task-list";
import { GanttTimeline } from "@/components/app/gantt-timeline";
import { InitialsAvatar, StatusBadge } from "@/components/app/primitives";
import { EditRow, IconPicker, TonePicker } from "@/components/app/edit-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Form = {
  name: string;
  summary: string;
  description: string;
  statusLabel: string;
  statusTone: Tone;
  icon: IconKey;
  tone: Tone;
};

function toForm(p: Project): Form {
  return {
    name: p.name,
    summary: p.summary,
    description: p.description,
    statusLabel: p.status.label,
    statusTone: p.status.tone,
    icon: p.icon,
    tone: p.tone,
  };
}

export function ProjectDetail({
  project,
  people: initialPeople,
  allConnections,
}: {
  project: Project;
  people: Connection[];
  allConnections: Connection[];
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<Project>(project);
  const [people, setPeople] = useState<Connection[]>(initialPeople);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(() => toForm(project));
  const [, startTransition] = useTransition();

  const setInput =
    (k: "name" | "summary" | "description" | "statusLabel") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const Icon = Icons[current.icon];
  const linkedIds = new Set(people.map((p) => p.id));
  const candidates = allConnections.filter((c) => !linkedIds.has(c.id));

  const startEdit = () => {
    setForm(toForm(current));
    setEditing(true);
  };

  const save = () => {
    const name = form.name.trim();
    if (!name) return;
    setCurrent((p) => ({
      ...p,
      name,
      summary: form.summary.trim(),
      description: form.description.trim(),
      icon: form.icon,
      tone: form.tone,
      status: { label: form.statusLabel.trim(), tone: form.statusTone },
    }));
    startTransition(() =>
      updateProject(current.id, {
        name,
        summary: form.summary,
        description: form.description,
        statusLabel: form.statusLabel,
        statusTone: form.statusTone,
        icon: form.icon,
        tone: form.tone,
      }),
    );
    setEditing(false);
  };

  const remove = () => {
    startTransition(async () => {
      await removeProject(current.id);
      router.push("/projects");
    });
  };

  const link = (connection: Connection) => {
    setPeople((prev) => [...prev, connection]);
    startTransition(() => linkParticipant(current.id, connection.id));
  };

  const unlink = (id: string) => {
    setPeople((prev) => prev.filter((p) => p.id !== id));
    startTransition(() => unlinkParticipant(current.id, id));
  };

  return (
    <>
      <header>
        <div className="mx-auto flex max-w-5xl items-start gap-4 px-6 pt-6 pb-1">
          <div className="min-w-0 flex-1">
            <Link
              href="/projects"
              className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" /> Projects
            </Link>

            {editing ? (
              <div className="flex flex-col gap-2">
                <Input
                  value={form.name}
                  onChange={setInput("name")}
                  className="h-9 text-base font-semibold"
                  aria-label="Project name"
                />
                <Input
                  value={form.summary}
                  onChange={setInput("summary")}
                  placeholder="Short summary…"
                  className="h-8"
                  aria-label="Summary"
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-md",
                      toneBg[current.tone],
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <h1 className="font-heading text-lg leading-none font-bold tracking-tight uppercase">
                    {current.name}
                  </h1>
                </div>
                {current.summary ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {current.summary}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button disabled={!form.name.trim()} onClick={save}>
                  <Icons.check className="size-4" /> Save
                </Button>
              </>
            ) : (
              <>
                <StatusBadge
                  label={current.status.label}
                  tone={current.status.tone}
                />
                <Button variant="outline" onClick={startEdit}>
                  <Icons.edit className="size-4" /> Edit
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="More actions">
                      <Icons.dots className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="tone-red-ink focus:bg-destructive/10"
                      onSelect={remove}
                    >
                      <Icons.x className="size-4" /> Delete project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </header>

      <PageBody className="flex flex-col gap-7">
        {editing ? (
          <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
            <EditRow label="Description">
              <Textarea
                value={form.description}
                onChange={setInput("description")}
                placeholder="What is this project about?"
                className="min-h-20"
              />
            </EditRow>
            <div className="grid grid-cols-2 gap-4">
              <EditRow label="Status" htmlFor="p-status">
                <Input
                  id="p-status"
                  value={form.statusLabel}
                  onChange={setInput("statusLabel")}
                  placeholder="e.g. On track"
                  className="h-8"
                />
              </EditRow>
              <EditRow label="Status color">
                <TonePicker
                  value={form.statusTone}
                  onChange={(statusTone) =>
                    setForm((f) => ({ ...f, statusTone }))
                  }
                />
              </EditRow>
            </div>
            <EditRow label="Icon">
              <IconPicker
                value={form.icon}
                onChange={(icon) => setForm((f) => ({ ...f, icon }))}
              />
            </EditRow>
            <EditRow label="Accent color">
              <TonePicker
                value={form.tone}
                onChange={(tone) => setForm((f) => ({ ...f, tone }))}
              />
            </EditRow>
          </div>
        ) : current.description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {current.description}
          </p>
        ) : null}

        <Section
          title="Connections"
          action={
            candidates.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Icons.plus className="size-3.5" /> Link person
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                  {candidates.map((c) => (
                    <DropdownMenuItem key={c.id} onSelect={() => link(c)}>
                      <InitialsAvatar
                        name={c.name}
                        tone={c.avatarTone}
                        className="size-5 text-[9px]"
                      />
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null
          }
        >
          {people.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {people.map((c) => (
                <div
                  key={c.id}
                  className="group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                >
                  <InitialsAvatar name={c.name} tone={c.avatarTone} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    {c.role || c.company ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {[c.role, c.company].filter(Boolean).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => unlink(c.id)}
                    aria-label={`Unlink ${c.name}`}
                    className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Icons.x className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No one linked yet.
            </p>
          )}
        </Section>

        <Section title="Tasks">
          <TaskList tasks={current.tasks} projectId={current.id} />
        </Section>

        {current.phases.length > 0 ? (
          <Section title="Timeline">
            <GanttTimeline phases={current.phases} />
          </Section>
        ) : null}
      </PageBody>
    </>
  );
}
