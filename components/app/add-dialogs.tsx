"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/lib/icons";
import {
  createConnection,
  createEvent,
  createProject,
} from "@/lib/data/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
 * fields, calls its Server Action, and closes on success — the action
 * revalidates the page so the new row appears.
 */

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function AddConnectionDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", role: "", company: "", email: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    startTransition(async () => {
      await createConnection(form);
      setForm({ name: "", role: "", company: "", email: "" });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Icons.plus className="size-4" /> Add connection
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add connection</DialogTitle>
          <DialogDescription>Someone new to keep up with.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label="Name" htmlFor="c-name">
            <Input id="c-name" autoFocus value={form.name} onChange={set("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role" htmlFor="c-role">
              <Input id="c-role" value={form.role} onChange={set("role")} />
            </Field>
            <Field label="Company" htmlFor="c-company">
              <Input id="c-company" value={form.company} onChange={set("company")} />
            </Field>
          </div>
          <Field label="Email" htmlFor="c-email">
            <Input id="c-email" type="email" value={form.email} onChange={set("email")} />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button disabled={!form.name.trim() || pending} onClick={submit}>
            <Icons.plus className="size-4" /> Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddEventDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", eventDate: "", location: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    startTransition(async () => {
      await createEvent(form);
      setForm({ name: "", eventDate: "", location: "" });
      setOpen(false);
    });
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
          <Field label="Name" htmlFor="e-name">
            <Input id="e-name" autoFocus value={form.name} onChange={set("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="e-date">
              <Input id="e-date" type="date" value={form.eventDate} onChange={set("eventDate")} />
            </Field>
            <Field label="Location" htmlFor="e-location">
              <Input id="e-location" value={form.location} onChange={set("location")} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!form.name.trim() || !form.eventDate || pending}
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
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", summary: "" });

  function submit() {
    startTransition(async () => {
      await createProject(form);
      setForm({ name: "", summary: "" });
      setOpen(false);
    });
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
          <Field label="Name" htmlFor="p-name">
            <Input
              id="p-name"
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Summary" htmlFor="p-summary">
            <Textarea
              id="p-summary"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              className="min-h-16"
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button disabled={!form.name.trim() || pending} onClick={submit}>
            <Icons.plus className="size-4" /> Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
