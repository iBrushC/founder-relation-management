"use client";

import { useState } from "react";
import { Icons } from "@/lib/icons";
import type { Connection, EventItem, Tone } from "@/lib/data";
import { formatWhen, isUpcoming } from "@/lib/data/format";
import {
  promoteEventGuest,
  setEventParticipants,
  updateEvent,
} from "@/lib/data/actions";
import { InitialsAvatar, PersonRow, StatusBadge } from "@/components/app/primitives";
import { EventsList } from "@/components/app/list-contexts";
import {
  ConnectionCombobox,
  EditRow,
  GuestPicker,
  TonePicker,
} from "@/components/app/edit-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutationToast } from "@/components/ui/toast";
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

type Form = {
  name: string;
  date: string;
  location: string;
  link: string;
  /** Hosting and being invited are mutually exclusive — checking one clears the other. */
  hostedByMe: boolean;
  invitedById: string | null;
  /** Guests who are connections. */
  metIds: string[];
  /** Guests who aren't connections (yet) — plain names. */
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
    hostedByMe: e.hostedByMe ?? false,
    invitedById: e.invitedById ?? null,
    metIds: e.metIds,
    metGuests: e.metGuests ?? [],
    note: e.note,
    avatarTone: e.avatarTone,
  };
}

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

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
  const showResult = useMutationToast();
  const [current, setCurrent] = useState<EventItem>(event);
  const [editing, setEditing] = useState(initialEditing);
  const [form, setForm] = useState<Form>(() => toForm(event));
  // Guest currently being promoted, so its row can show progress.
  const [promoting, setPromoting] = useState<string | null>(null);
  // Connections promoted in this panel, held until `revalidatePath` lands and
  // the page hands down a `connectionsById` that includes them.
  const [promoted, setPromoted] = useState<Record<string, Connection>>({});

  const peopleById = { ...connectionsById, ...promoted };
  const people = Object.values(peopleById).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const setInput =
    (k: "name" | "date" | "location" | "link") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const startEdit = () => {
    setForm(toForm(current));
    setEditing(true);
  };

  const save = () => {
    const name = form.name.trim();
    if (!name || !form.date) return;
    const link = form.link.trim();
    const next: EventItem = {
      ...current,
      name,
      date: form.date,
      when: formatWhen(form.date),
      upcoming: isUpcoming(form.date),
      where: form.location.trim(),
      metIds: form.metIds,
      metGuests: form.metGuests,
      note: form.note.trim(),
      link: link || undefined,
      hostedByMe: form.hostedByMe,
      invitedById: form.invitedById,
      avatarTone: form.avatarTone,
    };
    setCurrent(next);

    // The event row and its guest links are separate writes; only touch the
    // join table when the guest list actually changed.
    const guestsChanged = !sameIds(current.metIds, form.metIds);
    const action = async () => {
      const result = await updateEvent(current.id, {
        name,
        eventDate: form.date,
        location: form.location,
        metGuests: form.metGuests,
        note: form.note,
        link,
        hostedByMe: form.hostedByMe,
        invitedById: form.invitedById,
        avatarTone: form.avatarTone,
      });
      if (!result.ok || !guestsChanged) return result;
      return setEventParticipants(current.id, form.metIds);
    };
    if (list) list.update(next, action);
    else void action();
    setEditing(false);
  };

  /**
   * Turn a plain-name guest into a real connection. Awaited rather than
   * optimistic: the new connection's id only exists once the server replies.
   */
  const promote = async (name: string) => {
    setPromoting(name);
    const result = await promoteEventGuest(current.id, name);
    setPromoting(null);
    if (!showResult(result, { error: "Couldn't add that connection" })) return;
    const created = result.ok ? result.data : undefined;
    if (!created) return;
    setPromoted((p) => ({ ...p, [created.id]: created }));
    setCurrent((e) => ({
      ...e,
      metIds: [...e.metIds, created.id],
      metGuests: (e.metGuests ?? []).filter(
        (g) => g.toLowerCase() !== name.toLowerCase(),
      ),
    }));
  };

  const met = current.metIds.map((id) => peopleById[id]).filter(Boolean);
  const guests = current.metGuests ?? [];
  const invitedBy = current.invitedById
    ? peopleById[current.invitedById]
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

            <div className="flex flex-col gap-3">
              <label
                htmlFor="e-hosting"
                className="flex w-fit cursor-pointer items-center gap-2.5 text-sm"
              >
                <Checkbox
                  id="e-hosting"
                  checked={form.hostedByMe}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({
                      ...f,
                      hostedByMe: checked === true,
                      // You either host or you're invited, never both.
                      invitedById: checked === true ? null : f.invitedById,
                    }))
                  }
                />
                I&rsquo;m hosting this event
              </label>
              {!form.hostedByMe ? (
                <EditRow label="Invited by">
                  <ConnectionCombobox
                    people={people}
                    value={form.invitedById}
                    onChange={(invitedById) =>
                      setForm((f) => ({ ...f, invitedById }))
                    }
                    emptyLabel="No one in particular"
                  />
                </EditRow>
              ) : null}
            </div>

            <EditRow label="Guests">
              <GuestPicker
                people={people}
                metIds={form.metIds}
                guests={form.metGuests}
                onChange={({ metIds, guests }) =>
                  setForm((f) => ({ ...f, metIds, metGuests: guests }))
                }
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

            <Block title="Guests">
              {met.length === 0 && guests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one logged yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {met.map((c) => (
                    <PersonRow
                      key={c.id}
                      name={c.name}
                      subtitle={[c.role, c.company].filter(Boolean).join(" · ")}
                      tone={c.avatarTone}
                    />
                  ))}
                  {guests.map((name) => (
                    <PersonRow
                      key={name}
                      name={name}
                      subtitle="Not a connection"
                      tone="slate"
                      action={
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={promoting !== null}
                          onClick={() => promote(name)}
                          aria-label={`Make ${name} a connection`}
                          className="shrink-0"
                        >
                          {promoting === name ? (
                            "Adding…"
                          ) : (
                            <>
                              <Icons.plus /> Connection
                            </>
                          )}
                        </Button>
                      }
                    />
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
