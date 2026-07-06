"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { outreachStatusTone } from "@/lib/tone";
import {
  OUTREACH_STATUSES,
  type Connection,
  type Outreach,
  type OutreachStatus,
} from "@/lib/data";
import { formatMonthDay } from "@/lib/data/format";
import {
  createOutreach,
  removeOutreach,
  updateOutreach,
} from "@/lib/data/actions";
import { popProps, useReactiveList } from "@/components/app/reactive-list";
import { StatusBadge, InitialsAvatar } from "@/components/app/primitives";
import { EditRow } from "@/components/app/edit-fields";
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

/** ISO date `days` from today (used to default the follow-up reminder). */
function plusDaysIso(days: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayIso(): string {
  return plusDaysIso(0);
}

/** Ensure a website value is a navigable URL (prepend https:// if bare). */
function websiteHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Show a website compactly — drop the scheme, `www.`, and trailing slash. */
function prettyWebsite(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

const NONE = "__none__";

type Draft = {
  label: string;
  connectionId: string;
  channel: string;
  email: string;
  phone: string;
  website: string;
  status: OutreachStatus;
  lastContacted: string;
  followUpAt: string;
  notes: string;
};

function emptyDraft(): Draft {
  return {
    label: "",
    connectionId: NONE,
    channel: "Email",
    email: "",
    phone: "",
    website: "",
    status: "Not started",
    lastContacted: "",
    followUpAt: plusDaysIso(7), // default reminder one week out
    notes: "",
  };
}

function draftFrom(o: Outreach): Draft {
  return {
    label: o.label,
    connectionId: o.connectionId ?? NONE,
    channel: o.channel,
    email: o.email,
    phone: o.phone,
    website: o.website,
    status: o.status,
    lastContacted: o.lastContacted,
    followUpAt: o.followUpAt,
    notes: o.notes,
  };
}

/**
 * Outreach for a project — one row per organization or person you've reached out
 * to, each with a follow-up reminder date so nobody goes cold. Not connections:
 * these are project-scoped and may never turn into one. Renders below Tasks and
 * the Timeline on the project page.
 *
 * Add/remove run through the same optimistic `useReactiveList` base as the
 * Connections table, so rows pop in and out with the same animation; edits are
 * applied in place. Each change persists in the background via the outreach
 * actions.
 */
export function OutreachTable({
  projectId,
  outreach,
  people,
}: {
  projectId: string;
  outreach: Outreach[];
  people: Connection[];
}) {
  const list = useReactiveList<Outreach>(outreach);
  const items = list.items;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  const nameOf = (id: string | null) =>
    id ? people.find((p) => p.id === id) ?? null : null;

  const toInput = (d: Draft) => ({
    label: d.label.trim(),
    channel: d.channel.trim(),
    email: d.email.trim(),
    phone: d.phone.trim(),
    website: d.website.trim(),
    status: d.status,
    connectionId: d.connectionId === NONE ? null : d.connectionId,
    lastContacted: d.lastContacted || "",
    followUpAt: d.followUpAt || "",
    notes: d.notes.trim(),
  });

  const add = () => {
    const input = toInput(draft);
    if (!input.label) return;
    const optimistic: Outreach = {
      id: `optimistic-${crypto.randomUUID()}`,
      label: input.label,
      connectionId: input.connectionId,
      channel: input.channel,
      email: input.email,
      phone: input.phone,
      website: input.website,
      status: input.status,
      lastContacted: input.lastContacted,
      followUpAt: input.followUpAt,
      notes: input.notes,
    };
    list.add(optimistic, () => createOutreach(projectId, input));
    setDraft(emptyDraft());
    setAdding(false);
  };

  const saveEdit = (id: string) => {
    const input = toInput(draft);
    if (!input.label) return;
    const current = items.find((o) => o.id === id);
    if (!current) return;
    list.update({ ...current, ...input }, () =>
      updateOutreach(id, input, projectId),
    );
    setEditingId(null);
  };

  const remove = (id: string) => {
    list.remove(id, () => removeOutreach(id, projectId));
  };

  const startEdit = (o: Outreach) => {
    setDraft(draftFrom(o));
    setEditingId(o.id);
    setAdding(false);
  };

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-xs tabular-nums text-muted-foreground">
          {items.length} {items.length === 1 ? "recipient" : "recipients"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            setDraft(emptyDraft());
            setAdding((a) => !a);
            setEditingId(null);
          }}
        >
          <Icons.plus className="size-3.5" /> New outreach
        </Button>
      </div>

      {adding ? (
        <OutreachForm
          draft={draft}
          setDraft={setDraft}
          people={people}
          onSubmit={add}
          onCancel={() => setAdding(false)}
          submitLabel="Add outreach"
        />
      ) : null}

      {/* Column header (hidden on narrow screens) */}
      {items.length > 0 ? (
        <div className="hidden items-center gap-3 border-b border-border px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:flex">
          <span className="flex-1">Recipient</span>
          <span className="w-32">Contact</span>
          <span className="w-28">Status</span>
          <span className="w-28">Follow-up</span>
          <span className="w-14" />
        </div>
      ) : null}

      <ul className="divide-y divide-border">
        {items.map((o) => {
          if (editingId === o.id) {
            return (
              <li key={o.id}>
                <OutreachForm
                  draft={draft}
                  setDraft={setDraft}
                  people={people}
                  onSubmit={() => saveEdit(o.id)}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save"
                />
              </li>
            );
          }

          const contact = nameOf(o.connectionId);
          const overdue =
            o.followUpAt !== "" &&
            o.followUpAt < todayIso() &&
            o.status !== "Replied" &&
            o.status !== "Closed";
          const pop = popProps(list, o.id);

          return (
            <li
              key={o.id}
              onAnimationEnd={pop.onAnimationEnd}
              className={cn(
                "group flex flex-col gap-2 px-4 py-2.5 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3",
                pop.className,
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{o.label}</span>
                  {o.channel ? (
                    <span className="shrink-0 rounded border border-border px-1.5 py-px text-[10px] font-normal text-muted-foreground">
                      {o.channel}
                    </span>
                  ) : null}
                </div>
                {o.email || o.phone || o.website ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {o.email ? (
                      <a
                        href={`mailto:${o.email}`}
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      >
                        <Icons.mail className="size-3 shrink-0" />
                        <span className="truncate">{o.email}</span>
                      </a>
                    ) : null}
                    {o.phone ? (
                      <a
                        href={`tel:${o.phone.replace(/[^\d+]/g, "")}`}
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      >
                        <Icons.phone className="size-3 shrink-0" />
                        <span className="truncate">{o.phone}</span>
                      </a>
                    ) : null}
                    {o.website ? (
                      <a
                        href={websiteHref(o.website)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      >
                        <Icons.globe className="size-3 shrink-0" />
                        <span className="truncate">{prettyWebsite(o.website)}</span>
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {o.notes ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {o.notes}
                  </p>
                ) : null}
              </div>

              <div className="w-32 shrink-0 truncate text-sm text-muted-foreground">
                {contact ? (
                  <span className="flex items-center gap-1.5">
                    <InitialsAvatar
                      name={contact.name}
                      tone={contact.avatarTone}
                      className="size-5 text-[9px]"
                    />
                    <span className="truncate">{contact.name}</span>
                  </span>
                ) : (
                  "—"
                )}
              </div>

              <div className="w-28 shrink-0">
                <StatusBadge label={o.status} tone={outreachStatusTone[o.status]} />
              </div>

              <div
                className={cn(
                  "w-28 shrink-0 text-xs tabular-nums",
                  overdue ? "font-medium tone-red-ink" : "text-muted-foreground",
                )}
              >
                {o.followUpAt ? (
                  <span className="inline-flex items-center gap-1">
                    <Icons.send className="size-3" />
                    {formatMonthDay(o.followUpAt)}
                    {overdue ? " · due" : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

              <div className="flex w-14 shrink-0 items-center gap-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => startEdit(o)}
                  aria-label="Edit outreach"
                >
                  <Icons.edit className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(o.id)}
                  aria-label="Delete outreach"
                >
                  <Icons.x className="size-4" />
                </Button>
              </div>
            </li>
          );
        })}

        {items.length === 0 && !adding ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            No outreach yet. Track who you&rsquo;ve reached out to for weekly
            follow-up reminders.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Shared add/edit form for a single outreach recipient. */
function OutreachForm({
  draft,
  setDraft,
  people,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  people: Connection[];
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const set =
    <K extends keyof Draft>(k: K) =>
    (v: Draft[K]) =>
      setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="flex flex-col gap-4 border-b border-border bg-muted/30 px-4 py-4">
      <EditRow label="Recipient" htmlFor="o-label">
        <Input
          id="o-label"
          autoFocus
          value={draft.label}
          onChange={(e) => set("label")(e.target.value)}
          placeholder="Company or person, e.g. Beacon Capital"
          className="h-8"
        />
      </EditRow>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <EditRow label="Contact">
          <Select
            value={draft.connectionId}
            onValueChange={(v) => set("connectionId")(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No one</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditRow>
        <EditRow label="Channel" htmlFor="o-channel">
          <Input
            id="o-channel"
            value={draft.channel}
            onChange={(e) => set("channel")(e.target.value)}
            placeholder="Email, LinkedIn…"
            className="h-9"
          />
        </EditRow>
        <EditRow label="Email" htmlFor="o-email">
          <Input
            id="o-email"
            type="email"
            inputMode="email"
            value={draft.email}
            onChange={(e) => set("email")(e.target.value)}
            placeholder="name@company.com"
            className="h-9"
          />
        </EditRow>
        <EditRow label="Phone" htmlFor="o-phone">
          <Input
            id="o-phone"
            type="tel"
            inputMode="tel"
            value={draft.phone}
            onChange={(e) => set("phone")(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="h-9"
          />
        </EditRow>
        <EditRow label="Website" htmlFor="o-website">
          <Input
            id="o-website"
            type="url"
            inputMode="url"
            value={draft.website}
            onChange={(e) => set("website")(e.target.value)}
            placeholder="company.com"
            className="h-9"
          />
        </EditRow>
        <EditRow label="Status">
          <Select
            value={draft.status}
            onValueChange={(v) => set("status")(v as OutreachStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTREACH_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </EditRow>
        <EditRow label="Follow-up reminder" htmlFor="o-follow">
          <Input
            id="o-follow"
            type="date"
            value={draft.followUpAt}
            onChange={(e) => set("followUpAt")(e.target.value)}
            className="h-9"
          />
        </EditRow>
      </div>

      <EditRow label="Notes" htmlFor="o-notes">
        <Textarea
          id="o-notes"
          value={draft.notes}
          onChange={(e) => set("notes")(e.target.value)}
          placeholder="What was sent, what to follow up on…"
          className="min-h-14"
        />
      </EditRow>

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
