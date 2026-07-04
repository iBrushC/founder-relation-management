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

type Form = {
  name: string;
  date: string;
  location: string;
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
    (k: "name" | "date" | "location") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const startEdit = () => {
    setForm(toForm(current));
    setEditing(true);
  };

  const save = () => {
    const name = form.name.trim();
    if (!name || !form.date) return;
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
