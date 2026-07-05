"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icons, type IconKey } from "@/lib/icons";
import { toneBg } from "@/lib/tone";
import type { Connection, Phase, Project, Tone } from "@/lib/data";
import {
  createLinkedConnection,
  createStage,
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
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [addingStage, setAddingStage] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
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

  /** Create a brand-new connection and link it to this project in one step. */
  const addNewPerson = (input: {
    name: string;
    role: string;
    company: string;
    email: string;
  }) => {
    const name = input.name.trim();
    if (!name) return;
    startTransition(async () => {
      const created = await createLinkedConnection(current.id, input);
      if (created) setPeople((prev) => [...prev, created]);
    });
    setAddingPerson(false);
  };

  /** Append a stage to the Gantt timeline (optimistic; persisted in the background). */
  const addStage = (input: {
    label: string;
    start: string;
    end: string;
    tone: Tone;
  }) => {
    const label = input.label.trim();
    if (!label || !input.start || !input.end) return;
    const [start, end] =
      input.start <= input.end ? [input.start, input.end] : [input.end, input.start];
    const optimistic: Phase = {
      id: crypto.randomUUID(),
      label,
      tone: input.tone,
      start,
      end,
    };
    setCurrent((p) => ({ ...p, phases: [...p.phases, optimistic] }));
    startTransition(() =>
      createStage(current.id, {
        label,
        startDate: start,
        endDate: end,
        tone: input.tone,
      }),
    );
    setAddingStage(false);
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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAddingPerson(true)}
              >
                <Icons.plus className="size-3.5" /> Add new
              </Button>
              {candidates.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Icons.link className="size-3.5" /> Link existing
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="max-h-72 overflow-y-auto"
                  >
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
              ) : null}
            </div>
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

        <Section
          title="Timeline"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddingStage((v) => !v)}
            >
              <Icons.plus className="size-3.5" /> Add to Gantt
            </Button>
          }
        >
          {addingStage ? (
            <StageForm
              onAdd={addStage}
              onCancel={() => setAddingStage(false)}
            />
          ) : null}
          {current.phases.length > 0 ? (
            <GanttTimeline phases={current.phases} />
          ) : !addingStage ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No stages yet. Add one to build the Gantt chart.
            </p>
          ) : null}
        </Section>
      </PageBody>

      <AddPersonDialog
        open={addingPerson}
        onOpenChange={setAddingPerson}
        onAdd={addNewPerson}
      />
    </>
  );
}

/** Inline form for adding a stage to the Gantt timeline. */
function StageForm({
  onAdd,
  onCancel,
}: {
  onAdd: (input: { label: string; start: string; end: string; tone: Tone }) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [tone, setTone] = useState<Tone>("green");
  const valid = label.trim() && start && end;

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
      <EditRow label="Stage name" htmlFor="stage-label">
        <Input
          id="stage-label"
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Beta launch"
          className="h-8"
        />
      </EditRow>
      <div className="grid grid-cols-2 gap-4">
        <EditRow label="Start" htmlFor="stage-start">
          <Input
            id="stage-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-8"
          />
        </EditRow>
        <EditRow label="End" htmlFor="stage-end">
          <Input
            id="stage-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="h-8"
          />
        </EditRow>
      </div>
      <EditRow label="Color">
        <TonePicker value={tone} onChange={setTone} />
      </EditRow>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!valid}
          onClick={() => onAdd({ label, start, end, tone })}
        >
          <Icons.plus className="size-4" /> Add stage
        </Button>
      </div>
    </div>
  );
}

/** Dialog for creating a new connection that's auto-linked to the project. */
function AddPersonDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: {
    name: string;
    role: string;
    company: string;
    email: string;
  }) => void;
}) {
  const [form, setForm] = useState({ name: "", role: "", company: "", email: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    onAdd({
      name: form.name.trim(),
      role: form.role.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
    });
    setForm({ name: "", role: "", company: "", email: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add connection</DialogTitle>
          <DialogDescription>
            Creates a new connection and links it to this project.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-name" className="text-xs text-muted-foreground">
              Name
            </Label>
            <Input id="np-name" autoFocus value={form.name} onChange={set("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-role" className="text-xs text-muted-foreground">
                Role
              </Label>
              <Input id="np-role" value={form.role} onChange={set("role")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="np-company" className="text-xs text-muted-foreground">
                Company
              </Label>
              <Input id="np-company" value={form.company} onChange={set("company")} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="np-email" className="text-xs text-muted-foreground">
              Email
            </Label>
            <Input id="np-email" type="email" value={form.email} onChange={set("email")} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button disabled={!form.name.trim()} onClick={submit}>
            <Icons.plus className="size-4" /> Add & link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
