"use client";

import { useState } from "react";
import { Icons } from "@/lib/icons";
import type { Connection, EventItem, Project } from "@/lib/data";
import {
  createConnection,
  createEvent,
  createProject,
} from "@/lib/data/actions";
import { formatWhen, isUpcoming } from "@/lib/data/format";
import {
  ConnectionsList,
  EventsList,
  ProjectsList,
} from "@/components/app/list-contexts";
import { EditRow } from "@/components/app/edit-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * The three "add" dialogs behind the page-header buttons. Each collects a few
 * fields, then hands an *optimistic* row to its list context — the new row pops
 * in immediately — while the Server Action persists and revalidates in the
 * background. The temporary row is swapped for the real one atomically on commit.
 */

/** A client-only id for the optimistic row; the real DB id replaces it on commit. */
function tempId(): string {
  return `optimistic-${crypto.randomUUID()}`;
}

export function AddConnectionDialog({
  size = "default",
  variant = "default",
  label = "Add connection",
}: {
  /** Trigger button size — `sm` for a compact section-header button. */
  size?: "default" | "sm";
  variant?: "default" | "ghost" | "outline" | "secondary";
  label?: string;
} = {}) {
  const list = ConnectionsList.useList();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", company: "", email: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    const input = {
      name: form.name.trim(),
      role: form.role.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
    };
    // Mirror the row `createConnection` will produce (avatarTone defaults to "slate").
    const optimistic: Connection = {
      id: tempId(),
      name: input.name,
      role: input.role,
      company: input.company,
      avatarTone: "slate",
      tags: [],
      last: "Just now",
      rank: -1,
      email: input.email,
      phone: "",
      location: "",
      linkedin: "",
      birthday: "—",
      note: "",
      extraFields: [],
      timeline: [],
      // A brand-new connection has neither: extra addresses are added by editing,
      // and Gmail threads only appear after a sync.
      altEmails: [],
      emailThreads: [],
    };
    list.add(optimistic, () => createConnection(input));
    setForm({ name: "", role: "", company: "", email: "" });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant}>
          <Icons.plus className={size === "sm" ? "size-3.5" : "size-4"} /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add connection</DialogTitle>
          <DialogDescription>Someone new to keep up with.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <EditRow label="Name" htmlFor="c-name">
            <Input id="c-name" autoFocus value={form.name} onChange={set("name")} />
          </EditRow>
          <div className="grid grid-cols-2 gap-3">
            <EditRow label="Role" htmlFor="c-role">
              <Input id="c-role" value={form.role} onChange={set("role")} />
            </EditRow>
            <EditRow label="Company" htmlFor="c-company">
              <Input id="c-company" value={form.company} onChange={set("company")} />
            </EditRow>
          </div>
          <EditRow label="Email" htmlFor="c-email">
            <Input id="c-email" type="email" value={form.email} onChange={set("email")} />
          </EditRow>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button disabled={!form.name.trim()} onClick={submit}>
            <Icons.plus className="size-4" /> Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddEventDialog() {
  const list = EventsList.useList();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", eventDate: "", location: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    const input = {
      name: form.name.trim(),
      eventDate: form.eventDate,
      location: form.location.trim(),
    };
    const optimistic: EventItem = {
      id: tempId(),
      name: input.name,
      when: formatWhen(input.eventDate),
      date: input.eventDate,
      where: input.location,
      metIds: [],
      metGuests: [],
      note: "",
      upcoming: isUpcoming(input.eventDate),
      avatarTone: "slate",
      rank: -1,
    };
    list.add(optimistic, () => createEvent(input));
    setForm({ name: "", eventDate: "", location: "" });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Icons.plus className="size-4" /> Add event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add event</DialogTitle>
          <DialogDescription>A mixer, demo day, or meetup.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <EditRow label="Name" htmlFor="e-name">
            <Input id="e-name" autoFocus value={form.name} onChange={set("name")} />
          </EditRow>
          <div className="grid grid-cols-2 gap-3">
            <EditRow label="Date" htmlFor="e-date">
              <Input id="e-date" type="date" value={form.eventDate} onChange={set("eventDate")} />
            </EditRow>
            <EditRow label="Location" htmlFor="e-location">
              <Input id="e-location" value={form.location} onChange={set("location")} />
            </EditRow>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!form.name.trim() || !form.eventDate}
            onClick={submit}
          >
            <Icons.plus className="size-4" /> Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddProjectDialog() {
  const list = ProjectsList.useList();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", summary: "" });

  function submit() {
    const input = { name: form.name.trim(), summary: form.summary.trim() };
    // Mirror `createProject`'s defaults: "folder" icon, slate tone, Active status.
    const optimistic: Project = {
      id: tempId(),
      name: input.name,
      icon: "folder",
      tone: "slate",
      summary: input.summary,
      description: "",
      status: { label: "Active", tone: "green" },
      connectionIds: [],
      tasks: [],
      phases: [],
      outreach: [],
    };
    list.add(optimistic, () => createProject(input));
    setForm({ name: "", summary: "" });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Icons.plus className="size-4" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>A venture or campaign to track.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <EditRow label="Name" htmlFor="p-name">
            <Input
              id="p-name"
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </EditRow>
          <EditRow label="Summary" htmlFor="p-summary">
            <Textarea
              id="p-summary"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              className="min-h-16"
            />
          </EditRow>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button disabled={!form.name.trim()} onClick={submit}>
            <Icons.plus className="size-4" /> Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
