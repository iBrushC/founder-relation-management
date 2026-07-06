"use client";

import { useState } from "react";
import { Icons } from "@/lib/icons";
import type { Connection, EventItem, Tone } from "@/lib/data";
import { formatWhen, isUpcoming } from "@/lib/data/format";
import { updateEvent } from "@/lib/data/actions";
import { InitialsAvatar, StatusBadge } from "@/components/app/primitives";
import { EventsList } from "@/components/app/list-contexts";
import { ChipInput, EditRow, TonePicker } from "@/components/app/edit-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="eyebrow">{title}</span>
      {children}
    </div>
  );
}

/** One person met — a connection (with role) or a plain-text guest. */
function MetRow({
  name,
  role,
  tone,
}: {
  name: string;
  role?: string;
  tone?: EventItem["avatarTone"];
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2">
      <InitialsAvatar name={name} tone={tone} className="size-7 text-[10px]" />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-medium">{name}</div>
        {role ? (
          <div className="truncate text-xs text-muted-foreground">{role}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Sentinel `host` values that aren't a connection id. */
const HOST_NONE = "__none__";
const HOST_ME = "__me__";

type Form = {
  name: string;
  date: string;
  location: string;
  link: string;
  /** HOST_NONE, HOST_ME, or a connection id (whoever invited you). */
  host: string;
  organizers: string[];
  metGuests: string[];
  note: string;
  avatarTone: Tone;
};

function toForm(e: EventItem): Form {
  return {
    name: e.name,
    date: e.date ?? "",
    location: e.where,
    link: e.link ?? "",
    host: e.hostedByMe ? HOST_ME : (e.invitedById ?? HOST_NONE),
    organizers: e.organizers,
    metGuests: e.metGuests ?? [],
    note: e.note,
    avatarTone: e.avatarTone,
  };
}

export function EventPanel({
  event,
  connectionsById,
  open,
  onOpenChange,
  initialEditing = false,
}: {
  event: EventItem | null;
  connectionsById: Record<string, Connection>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEditing?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] gap-0 p-0 sm:max-w-[380px]">
        {event ? (
          <PanelBody
            key={event.id}
            event={event}
            connectionsById={connectionsById}
            initialEditing={initialEditing}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PanelBody({
  event,
  connectionsById,
  initialEditing,
  onClose,
}: {
  event: EventItem;
  connectionsById: Record<string, Connection>;
  initialEditing: boolean;
  onClose: () => void;
}) {
  const list = EventsList.useOptional();
  const [current, setCurrent] = useState<EventItem>(event);
  const [editing, setEditing] = useState(initialEditing);
  const [form, setForm] = useState<Form>(() => toForm(event));

  const setInput =
    (k: "name" | "date" | "location" | "link") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  // Connections, alphabetized, offered as "who invited you" choices.
  const people = Object.values(connectionsById).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const startEdit = () => {
    setForm(toForm(current));
    setEditing(true);
  };

  const save = () => {
    const name = form.name.trim();
    if (!name || !form.date) return;
    const link = form.link.trim();
    const hostedByMe = form.host === HOST_ME;
    const invitedById =
      form.host === HOST_ME || form.host === HOST_NONE ? null : form.host;
    const next: EventItem = {
      ...current,
      name,
      date: form.date,
      when: formatWhen(form.date),
      upcoming: isUpcoming(form.date),
      where: form.location.trim(),
      organizers: form.organizers,
      metGuests: form.metGuests,
      note: form.note.trim(),
      link: link || undefined,
      hostedByMe,
      invitedById,
      avatarTone: form.avatarTone,
    };
    setCurrent(next);
    const action = () =>
      updateEvent(current.id, {
        name,
        eventDate: form.date,
        location: form.location,
        organizers: form.organizers,
        metGuests: form.metGuests,
        note: form.note,
        link,
        hostedByMe,
        invitedById,
        avatarTone: form.avatarTone,
      });
    if (list) list.update(next, action);
    else void action();
    setEditing(false);
  };

  const met = current.metIds
    .map((id) => connectionsById[id])
    .filter(Boolean);
  const guests = current.metGuests ?? [];
  const invitedBy = current.invitedById
    ? connectionsById[current.invitedById]
    : undefined;

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
            <SheetDescription>{current.where || "Event"}</SheetDescription>
          </div>
        </div>
        {!editing ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge
              label={current.upcoming ? "Upcoming" : "Past"}
              tone={current.upcoming ? "blue" : "slate"}
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {current.when}
            </span>
          </div>
        ) : null}
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        {editing ? (
          <>
            <EditRow label="Name" htmlFor="e-name">
              <Input id="e-name" value={form.name} onChange={setInput("name")} />
            </EditRow>
            <div className="grid grid-cols-2 gap-3">
              <EditRow label="Date" htmlFor="e-date">
                <Input
                  id="e-date"
                  type="date"
                  value={form.date}
                  onChange={setInput("date")}
                />
              </EditRow>
              <EditRow label="Location" htmlFor="e-location">
                <Input
                  id="e-location"
                  value={form.location}
                  onChange={setInput("location")}
                />
              </EditRow>
            </div>
            <EditRow label="Event page" htmlFor="e-link">
              <Input
                id="e-link"
                type="url"
                inputMode="url"
                value={form.link}
                onChange={setInput("link")}
                placeholder="https://lu.ma/…"
              />
            </EditRow>
            <EditRow label="Host / invited by">
              <Select
                value={form.host}
                onValueChange={(host) => setForm((f) => ({ ...f, host }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HOST_NONE}>No one in particular</SelectItem>
                  <SelectItem value={HOST_ME}>I&rsquo;m hosting</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Invited by {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditRow>
            <EditRow label="Organizers">
              <ChipInput
                value={form.organizers}
                onChange={(organizers) =>
                  setForm((f) => ({ ...f, organizers }))
                }
                placeholder="Add an organizer…"
              />
            </EditRow>
            <EditRow label="Guests (not yet connections)">
              <ChipInput
                value={form.metGuests}
                onChange={(metGuests) => setForm((f) => ({ ...f, metGuests }))}
                placeholder="Add a guest…"
              />
            </EditRow>
            <EditRow label="Avatar color">
              <TonePicker
                value={form.avatarTone}
                onChange={(avatarTone) => setForm((f) => ({ ...f, avatarTone }))}
              />
            </EditRow>
            <EditRow label="Notes" htmlFor="e-note">
              <Textarea
                id="e-note"
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
            <Block title="Details">
              <div className="flex flex-col">
                <Field icon={Icons.calendar}>{current.when}</Field>
                {current.where ? (
                  <Field icon={Icons.pin}>{current.where}</Field>
                ) : null}
                {current.organizers.length > 0 ? (
                  <Field icon={Icons.users}>
                    {current.organizers.join(" · ")}
                  </Field>
                ) : null}
                {current.hostedByMe ? (
                  <Field icon={Icons.star}>You&rsquo;re hosting</Field>
                ) : invitedBy ? (
                  <Field icon={Icons.user}>Invited by {invitedBy.name}</Field>
                ) : null}
                {current.link ? (
                  <Field icon={Icons.link}>
                    <a
                      href={current.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Event page
                      <Icons.arrowUpRight className="size-3.5" />
                    </a>
                  </Field>
                ) : null}
              </div>
            </Block>

            <Block title="Who was met">
              {met.length === 0 && guests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one logged yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {met.map((c) => (
                    <MetRow
                      key={c.id}
                      name={c.name}
                      role={[c.role, c.company].filter(Boolean).join(" · ")}
                      tone={c.avatarTone}
                    />
                  ))}
                  {guests.map((name) => (
                    <MetRow key={name} name={name} tone="slate" />
                  ))}
                </div>
              )}
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
            <Button
              className="flex-1"
              disabled={!form.name.trim() || !form.date}
              onClick={save}
            >
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
