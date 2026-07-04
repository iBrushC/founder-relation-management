"use client";

import { useState } from "react";
import { Icons } from "@/lib/icons";
import type { Connection, Interaction, Tag as TagType, Tone } from "@/lib/data";
import { formatMonthDay, monthDayToIso } from "@/lib/data/format";
import {
  logInteraction,
  updateConnection,
  updateConnectionNote,
  updateInteractions,
} from "@/lib/data/actions";
import { InitialsAvatar, Tag } from "@/components/app/primitives";
import { ConnectionsList } from "@/components/app/list-contexts";
import { EditRow, TagEditor, TonePicker } from "@/components/app/edit-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Placeholder year used when storing a birthday (only month/day is shown). */
const BIRTH_YEAR = 2000;

function Field({
  icon: Icon,
  children,
}: {
  icon: (typeof Icons)[keyof typeof Icons];
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span>{children}</span>
    </div>
  );
}

function Block({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

/** The connection's editable fields, held while in edit mode. */
type Form = {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  location: string;
  /** ISO date (YYYY-MM-DD) or "" — bound to a date input. */
  birthday: string;
  tags: TagType[];
  avatarTone: Tone;
  note: string;
};

function toForm(c: Connection): Form {
  return {
    name: c.name,
    role: c.role,
    company: c.company,
    email: c.email,
    phone: c.phone,
    location: c.location,
    birthday: c.birthday === "—" ? "" : monthDayToIso(c.birthday, BIRTH_YEAR) ?? "",
    tags: c.tags,
    avatarTone: c.avatarTone,
    note: c.note,
  };
}

export function ConnectionPanel({
  connection,
  open,
  onOpenChange,
  initialEditing = false,
  initialLogOpen = false,
}: {
  connection: Connection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open straight into edit mode (e.g. from a row's pencil button). */
  initialEditing?: boolean;
  /** Open with the "log interaction" input revealed (from the log button). */
  initialLogOpen?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] gap-0 p-0 sm:max-w-[380px]">
        {connection ? (
          <PanelBody
            key={connection.id}
            connection={connection}
            initialEditing={initialEditing}
            initialLogOpen={initialLogOpen}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Inner body, remounted per connection (keyed by id) so `useState` initializers
 * re-seed from the selected row. Owns the local `current` view of the record and
 * the edit `form`; edits persist through the connections list (optimistic when a
 * provider is present) and are reflected locally right away.
 */
function PanelBody({
  connection,
  initialEditing,
  initialLogOpen,
  onClose,
}: {
  connection: Connection;
  initialEditing: boolean;
  initialLogOpen: boolean;
  onClose: () => void;
}) {
  const list = ConnectionsList.useOptional();
  const [current, setCurrent] = useState<Connection>(connection);
  const [editing, setEditing] = useState(initialEditing);
  const [form, setForm] = useState<Form>(() => toForm(connection));
  const [logOpen, setLogOpen] = useState(initialLogOpen);
  const [logText, setLogText] = useState("");

  const setField =
    <K extends keyof Form>(k: K) =>
    (v: Form[K]) =>
      setForm((f) => ({ ...f, [k]: v }));
  const setInput =
    (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  /** Apply `next` locally and to the shared list, running `action` to persist. */
  const persist = (next: Connection, action: () => Promise<unknown>) => {
    setCurrent(next);
    if (list) list.update(next, action);
    else void action();
  };

  const startEdit = () => {
    setForm(toForm(current));
    setEditing(true);
  };

  const save = () => {
    const name = form.name.trim();
    if (!name) return;
    const birthday = form.birthday || null;
    const next: Connection = {
      ...current,
      name,
      role: form.role.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      location: form.location.trim(),
      birthday: birthday ? formatMonthDay(birthday) : "—",
      tags: form.tags,
      avatarTone: form.avatarTone,
      note: form.note.trim(),
    };
    const noteChanged = form.note.trim() !== current.note;
    persist(next, async () => {
      await updateConnection(current.id, {
        name,
        role: form.role,
        company: form.company,
        email: form.email,
        phone: form.phone,
        location: form.location,
        birthday,
        tags: form.tags,
        avatarTone: form.avatarTone,
      });
      if (noteChanged) await updateConnectionNote(current.id, form.note);
    });
    setEditing(false);
  };

  const addLog = () => {
    const label = logText.trim();
    if (!label) return;
    const entry: Interaction = { label, when: "Just now" };
    const next: Connection = {
      ...current,
      timeline: [entry, ...current.timeline],
      last: entry.when,
    };
    persist(next, () => logInteraction(current.id, entry));
    setLogText("");
    setLogOpen(false);
  };

  const deleteLog = (index: number) => {
    const timeline = current.timeline.filter((_, i) => i !== index);
    const next: Connection = {
      ...current,
      timeline,
      last: timeline[0]?.when ?? current.last,
    };
    persist(next, () => updateInteractions(current.id, timeline));
  };

  return (
    <>
      <SheetHeader className="gap-3 border-b border-border p-5">
        <div className="flex items-center gap-3">
          <InitialsAvatar
            name={form.name || current.name}
            tone={editing ? form.avatarTone : current.avatarTone}
            className="size-11 text-sm"
          />
          <div className="min-w-0 flex-1">
            <SheetTitle className="font-sans text-base font-semibold">
              {current.name}
            </SheetTitle>
            <SheetDescription>
              {[current.role, current.company].filter(Boolean).join(" · ") ||
                "Connection"}
            </SheetDescription>
          </div>
        </div>
        {!editing && current.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {current.tags.map((t) => (
              <Tag key={t.label} {...t} />
            ))}
          </div>
        ) : null}
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        {editing ? (
          <>
            <EditRow label="Name" htmlFor="c-name">
              <Input id="c-name" value={form.name} onChange={setInput("name")} />
            </EditRow>
            <div className="grid grid-cols-2 gap-3">
              <EditRow label="Role" htmlFor="c-role">
                <Input id="c-role" value={form.role} onChange={setInput("role")} />
              </EditRow>
              <EditRow label="Company" htmlFor="c-company">
                <Input
                  id="c-company"
                  value={form.company}
                  onChange={setInput("company")}
                />
              </EditRow>
            </div>
            <EditRow label="Email" htmlFor="c-email">
              <Input
                id="c-email"
                type="email"
                value={form.email}
                onChange={setInput("email")}
              />
            </EditRow>
            <div className="grid grid-cols-2 gap-3">
              <EditRow label="Phone" htmlFor="c-phone">
                <Input
                  id="c-phone"
                  value={form.phone}
                  onChange={setInput("phone")}
                />
              </EditRow>
              <EditRow label="Birthday" htmlFor="c-birthday">
                <Input
                  id="c-birthday"
                  type="date"
                  value={form.birthday}
                  onChange={setInput("birthday")}
                />
              </EditRow>
            </div>
            <EditRow label="Location" htmlFor="c-location">
              <Input
                id="c-location"
                value={form.location}
                onChange={setInput("location")}
              />
            </EditRow>
            <EditRow label="Tags">
              <TagEditor value={form.tags} onChange={setField("tags")} />
            </EditRow>
            <EditRow label="Avatar color">
              <TonePicker
                value={form.avatarTone}
                onChange={setField("avatarTone")}
              />
            </EditRow>
            <EditRow label="Notes" htmlFor="c-note">
              <Textarea
                id="c-note"
                value={form.note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
                className="min-h-20"
              />
            </EditRow>
          </>
        ) : (
          <>
            <Block title="Contact">
              <div className="flex flex-col">
                {current.email ? (
                  <Field icon={Icons.mail}>{current.email}</Field>
                ) : null}
                {current.phone ? (
                  <Field icon={Icons.phone}>{current.phone}</Field>
                ) : null}
                {current.location ? (
                  <Field icon={Icons.pin}>{current.location}</Field>
                ) : null}
                {current.birthday && current.birthday !== "—" ? (
                  <Field icon={Icons.cake}>Birthday · {current.birthday}</Field>
                ) : null}
                {!current.email &&
                !current.phone &&
                !current.location &&
                (!current.birthday || current.birthday === "—") ? (
                  <p className="text-sm text-muted-foreground">
                    No contact details yet.
                  </p>
                ) : null}
              </div>
            </Block>

            <Block title="Notes">
              {current.note ? (
                <p className="rounded-md bg-muted p-3 text-sm leading-relaxed text-foreground/90">
                  {current.note}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
            </Block>

            <Block
              title="Recent"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setLogOpen((o) => !o)}
                >
                  <Icons.plus className="size-3.5" /> Log
                </Button>
              }
            >
              {logOpen ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    value={logText}
                    onChange={(e) => setLogText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLog();
                      }
                    }}
                    placeholder="e.g. Coffee, talked pilot…"
                    className="h-8"
                  />
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    onClick={addLog}
                    disabled={!logText.trim()}
                    aria-label="Add interaction"
                  >
                    <Icons.check className="size-4" />
                  </Button>
                </div>
              ) : null}
              {current.timeline.length > 0 ? (
                <ol className="flex flex-col gap-1.5">
                  {current.timeline.map((item, i) => (
                    <li
                      key={i}
                      className="group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <span className="h-7 w-1 shrink-0 rounded-full bg-primary/55" />
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.when}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="Delete interaction"
                        onClick={() => deleteLog(i)}
                        className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                      >
                        <Icons.x className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ol>
              ) : !logOpen ? (
                <p className="text-sm text-muted-foreground">
                  No interactions logged yet.
                </p>
              ) : null}
            </Block>
          </>
        )}
      </div>

      <SheetFooter className="flex-row gap-2 border-t border-border p-4">
        {editing ? (
          <>
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button className="flex-1" disabled={!form.name.trim()} onClick={save}>
              <Icons.check className="size-4" /> Save
            </Button>
          </>
        ) : (
          <>
            <Button className="flex-1" onClick={startEdit}>
              <Icons.edit className="size-4" /> Edit
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </>
        )}
      </SheetFooter>
    </>
  );
}
