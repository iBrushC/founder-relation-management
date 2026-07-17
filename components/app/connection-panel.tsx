"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { toneBg } from "@/lib/tone";
import type {
  Connection,
  EmailThread as EmailThreadType,
  ExtraField,
  Interaction,
  Tag as TagType,
  Tone,
} from "@/lib/data";
import { interactionTypeIcon } from "@/lib/data";
import {
  formatInteractionWhen,
  formatMonthDay,
  monthDayToIso,
  recognizeDate,
  sortInteractions,
  stripDateRange,
  todayIso,
} from "@/lib/data/format";
import {
  logInteraction,
  updateConnection,
  updateConnectionNote,
  updateInteractions,
} from "@/lib/data/actions";
import { LogInteractionDialog } from "@/components/app/log-interaction-dialog";
import { HighlightedTextarea } from "@/components/app/highlighted-textarea";
import { InitialsAvatar, Tag } from "@/components/app/primitives";
import { ConnectionsList } from "@/components/app/list-contexts";
import {
  EditRow,
  EmailListEditor,
  KeyValueEditor,
  TagEditor,
  TonePicker,
} from "@/components/app/edit-fields";
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
import type { ProjectLink } from "@/lib/data/project-links";

export type { ProjectLink };

/** Placeholder year used when storing a birthday (only month/day is shown). */
const BIRTH_YEAR = 2000;

/** Show a LinkedIn URL compactly — drop the scheme, `www.`, and trailing slash. */
function prettyLinkedin(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

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

/**
 * One row of the displayed timeline: either a hand-written interaction or a
 * synced Gmail chain.
 *
 * A log entry carries its `index` into `connection.timeline` explicitly. That's
 * the whole point of this type: edit and delete address entries by array index,
 * so once synced threads are interleaved, the position in *this* list no longer
 * matches the position in the stored array. Carrying the index makes the
 * distinction impossible to get wrong by accident.
 */
type TimelineEntry =
  | { kind: "log"; item: Interaction; index: number; date: string }
  | { kind: "email"; thread: EmailThreadType; date: string };

/**
 * Interleave hand-written interactions with synced Gmail, most recent first.
 * Display-only — neither source is mutated, and synced entries never enter the
 * array the write actions replace.
 */
function mergeTimeline(c: Connection): TimelineEntry[] {
  const logs: TimelineEntry[] = c.timeline.map((item, index) => ({
    kind: "log",
    item,
    index,
    date: item.date ?? "",
  }));
  const mail: TimelineEntry[] = c.emailThreads.map((thread) => ({
    kind: "email",
    thread,
    date: thread.date,
  }));
  // Undated legacy logs sort to the bottom, matching sortInteractions.
  return [...logs, ...mail].sort((a, b) => b.date.localeCompare(a.date));
}

/** A synced Gmail chain. Read-only: no edit or delete, unlike a logged entry. */
function EmailThreadItem({ thread }: { thread: EmailThreadType }) {
  const count =
    thread.messageCount > 1 ? `${thread.messageCount} messages` : "1 message";
  const direction =
    thread.direction === "sent"
      ? "Sent"
      : thread.direction === "received"
        ? "Received"
        : "Back and forth";

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <Icons.mail className="size-3.5" />
        </span>
        <span className="truncate text-sm font-medium">
          {thread.subject || "(no subject)"}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {thread.when}
        </span>
      </div>
      {thread.snippet ? (
        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
          {thread.snippet}
        </p>
      ) : null}
      {/* Says where this came from and why it can't be edited here. */}
      <p className="text-xs text-muted-foreground/80">
        {direction} · {count} · from Gmail
      </p>
    </li>
  );
}

/** The connection's editable fields, held while in edit mode. */
type Form = {
  name: string;
  role: string;
  company: string;
  email: string;
  /** Additional addresses; `email` stays the primary one. */
  altEmails: string[];
  phone: string;
  location: string;
  linkedin: string;
  /** ISO date (YYYY-MM-DD) or "" — bound to a date input. */
  birthday: string;
  tags: TagType[];
  avatarTone: Tone;
  note: string;
  extraFields: ExtraField[];
};

function toForm(c: Connection): Form {
  return {
    name: c.name,
    role: c.role,
    company: c.company,
    email: c.email,
    altEmails: c.altEmails,
    phone: c.phone,
    location: c.location,
    linkedin: c.linkedin,
    birthday: c.birthday === "—" ? "" : monthDayToIso(c.birthday, BIRTH_YEAR) ?? "",
    tags: c.tags,
    avatarTone: c.avatarTone,
    note: c.note,
    extraFields: c.extraFields,
  };
}

export function ConnectionPanel({
  connection,
  projects = [],
  tagSuggestions = [],
  open,
  onOpenChange,
  initialEditing = false,
}: {
  connection: Connection | null;
  /** Projects this connection is linked to. */
  projects?: ProjectLink[];
  /** Tags used elsewhere, offered as one-click picks in the editor. */
  tagSuggestions?: TagType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open straight into edit mode (e.g. from a row's pencil button). */
  initialEditing?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] gap-0 p-0 sm:max-w-[380px]">
        <SheetHeader className="sr-only">
          <SheetTitle>{connection?.name ?? "Connection"}</SheetTitle>
          <SheetDescription>Connection details</SheetDescription>
        </SheetHeader>
        {connection ? (
          <PanelBody
            key={connection.id}
            connection={connection}
            projects={projects}
            tagSuggestions={tagSuggestions}
            initialEditing={initialEditing}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Inline (in-page) variant used on the Connections page: the same body rendered
 * in a bordered card that slides out beside the collapsed list, rather than in
 * an overlay sheet.
 */
export function ConnectionDetailInline({
  connection,
  projects = [],
  tagSuggestions = [],
  initialEditing = false,
  onClose,
}: {
  connection: Connection;
  projects?: ProjectLink[];
  tagSuggestions?: TagType[];
  initialEditing?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="sfrm-slide-in relative flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-md border border-border bg-card">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label="Close details"
        className="absolute top-3 right-3 z-10 text-muted-foreground"
      >
        <Icons.x className="size-4" />
      </Button>
      <PanelBody
        key={connection.id}
        connection={connection}
        projects={projects}
        tagSuggestions={tagSuggestions}
        initialEditing={initialEditing}
        onClose={onClose}
      />
    </div>
  );
}

/**
 * Inner body, remounted per connection (keyed by id) so `useState` initializers
 * re-seed from the selected row. Owns the local `current` view of the record and
 * the edit `form`; edits persist through the connections list (optimistic when a
 * provider is present) and are reflected locally right away. Uses plain markup
 * (not Sheet primitives) so it renders identically inline or inside the Sheet.
 */
function PanelBody({
  connection,
  projects,
  tagSuggestions,
  initialEditing,
  onClose,
}: {
  connection: Connection;
  projects: ProjectLink[];
  tagSuggestions: TagType[];
  initialEditing: boolean;
  onClose: () => void;
}) {
  const list = ConnectionsList.useOptional();
  const [current, setCurrent] = useState<Connection>(connection);
  const [editing, setEditing] = useState(initialEditing);
  const [form, setForm] = useState<Form>(() => toForm(connection));
  const [logOpen, setLogOpen] = useState(false);
  const [logText, setLogText] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<number | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);

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
    const extraFields = form.extraFields
      .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
      .filter((f) => f.label && f.value);
    // Drop rows the user left blank. The action normalises (lowercase, dedupe)
    // before storing; this just keeps the optimistic copy honest.
    const altEmails = form.altEmails.map((a) => a.trim()).filter(Boolean);
    const next: Connection = {
      ...current,
      name,
      role: form.role.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      altEmails,
      phone: form.phone.trim(),
      location: form.location.trim(),
      linkedin: form.linkedin.trim(),
      birthday: birthday ? formatMonthDay(birthday) : "—",
      tags: form.tags,
      avatarTone: form.avatarTone,
      note: form.note.trim(),
      extraFields,
    };
    const noteChanged = form.note.trim() !== current.note;
    persist(next, async () => {
      await updateConnection(current.id, {
        name,
        role: form.role,
        company: form.company,
        email: form.email,
        altEmails,
        phone: form.phone,
        location: form.location,
        linkedin: form.linkedin,
        birthday,
        tags: form.tags,
        avatarTone: form.avatarTone,
        extraFields,
      });
      if (noteChanged) await updateConnectionNote(current.id, form.note);
    });
    setEditing(false);
  };

  const addLog = (entry: Interaction) => {
    // Keep the timeline sorted most-recent first so display and index-based
    // delete stay in agreement.
    const timeline = sortInteractions([entry, ...current.timeline]);
    const top = timeline[0];
    const next: Connection = {
      ...current,
      timeline,
      last: (formatInteractionWhen(top.date, top.until) ?? top.when),
    };
    persist(next, () => logInteraction(current.id, entry));
    setLogText("");
    setLogOpen(false);
  };

  // A date phrase recognized in the inline note ("coffee yesterday", "call Jun
  // 3"), highlighted as you type and dropped from the saved note on submit.
  const logDetected = recognizeDate(logText);

  /**
   * The fast path: log the inline free-text note. We stamp today's date unless
   * the note names one, which we recognize and strip out of the saved note.
   */
  const quickAdd = () => {
    if (!logText.trim()) return;
    const date = logDetected?.iso ?? todayIso();
    const label = logDetected
      ? stripDateRange(logText, logDetected.start, logDetected.end)
      : logText.trim();
    addLog({ label, date, when: formatInteractionWhen(date) ?? "Today" });
  };

  const deleteLog = (index: number) => {
    const timeline = current.timeline.filter((_, i) => i !== index);
    const top = timeline[0];
    const next: Connection = {
      ...current,
      timeline,
      last: top ? (formatInteractionWhen(top.date, top.until) ?? top.when) : current.last,
    };
    persist(next, () => updateInteractions(current.id, timeline));
  };

  /** Open the log dialog prepopulated with an existing entry, to edit it. */
  const editLog = (index: number) => {
    setEditingLog(index);
    setDetailsOpen(true);
  };

  const updateLog = (index: number, entry: Interaction) => {
    // Re-sort in case the edited date moved the entry; keep `last` in step.
    const timeline = sortInteractions(
      current.timeline.map((it, i) => (i === index ? entry : it)),
    );
    const top = timeline[0];
    const next: Connection = {
      ...current,
      timeline,
      last: top ? (formatInteractionWhen(top.date, top.until) ?? top.when) : current.last,
    };
    persist(next, () => updateInteractions(current.id, timeline));
    setEditingLog(null);
    setDetailsOpen(false);
  };

  const mergedTimeline = mergeTimeline(current);

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border p-5 pr-12">
        <div className="flex items-center gap-3">
          <InitialsAvatar
            name={form.name || current.name}
            tone={editing ? form.avatarTone : current.avatarTone}
            className="size-11 text-sm"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-sans text-base font-semibold">{current.name}</h2>
            <p className="text-sm text-muted-foreground">
              {[current.role, current.company].filter(Boolean).join(" · ") ||
                "Connection"}
            </p>
          </div>
        </div>
        {!editing && current.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {current.tags.map((t) => (
              <Tag key={t.label} {...t} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
        {editing ? (
          <>
            <EditRow label="Avatar color">
              <TonePicker
                value={form.avatarTone}
                onChange={setField("avatarTone")}
              />
            </EditRow>
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
            {/*
              Optional and secondary by design: most people need one address, so
              this stays out of the way until there's a reason to open it. It
              exists mainly so Gmail sync can find mail sent from a second
              address — hence the hint.
            */}
            <EditRow label="Other email addresses">
              <EmailListEditor
                value={form.altEmails}
                primary={form.email}
                onChange={setField("altEmails")}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Also matched when syncing Gmail — add a work or personal address
                they email from.
              </p>
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
            <EditRow label="LinkedIn" htmlFor="c-linkedin">
              <Input
                id="c-linkedin"
                type="url"
                inputMode="url"
                value={form.linkedin}
                onChange={setInput("linkedin")}
                placeholder="https://linkedin.com/in/…"
              />
            </EditRow>
            <EditRow label="Tags">
              <TagEditor
                value={form.tags}
                onChange={setField("tags")}
                suggestions={tagSuggestions}
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
            <EditRow label="Additional information">
              <KeyValueEditor
                value={form.extraFields}
                onChange={setField("extraFields")}
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
                {current.altEmails.map((address) => (
                  <Field key={address} icon={Icons.mail}>
                    <span className="text-muted-foreground">{address}</span>
                  </Field>
                ))}
                {current.phone ? (
                  <Field icon={Icons.phone}>{current.phone}</Field>
                ) : null}
                {current.location ? (
                  <Field icon={Icons.pin}>{current.location}</Field>
                ) : null}
                {current.linkedin ? (
                  <Field icon={Icons.linkedin}>
                    <a
                      href={current.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {prettyLinkedin(current.linkedin)}
                    </a>
                  </Field>
                ) : null}
                {current.birthday && current.birthday !== "—" ? (
                  <Field icon={Icons.cake}>Birthday · {current.birthday}</Field>
                ) : null}
                {!current.email &&
                current.altEmails.length === 0 &&
                !current.phone &&
                !current.location &&
                !current.linkedin &&
                (!current.birthday || current.birthday === "—") ? (
                  <p className="text-sm text-muted-foreground">
                    No contact details yet.
                  </p>
                ) : null}
              </div>
            </Block>

            {projects.length > 0 ? (
              <Block title="Projects">
                <div className="flex flex-wrap gap-1.5">
                  {projects.map((p) => {
                    const Icon = Icons[p.icon];
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className={cn(
                          "inline-flex h-6 items-center gap-1.5 rounded-[5px] px-2 text-xs font-medium transition-opacity hover:opacity-80",
                          toneBg[p.tone],
                        )}
                      >
                        <Icon className="size-3.5" />
                        {p.name}
                      </Link>
                    );
                  })}
                </div>
              </Block>
            ) : null}

            <Block title="Notes">
              {current.note ? (
                <p className="rounded-md bg-muted p-3 text-sm leading-relaxed text-foreground/90">
                  {current.note}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
            </Block>

            {current.extraFields.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setExtraOpen((o) => !o)}
                  aria-expanded={extraOpen}
                  className="flex cursor-pointer items-center justify-between gap-2 text-left"
                >
                  <span className="eyebrow">
                    Additional information · {current.extraFields.length}
                  </span>
                  <Icons.chevronRight
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      extraOpen && "rotate-90",
                    )}
                  />
                </button>
                {extraOpen ? (
                  <dl className="flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border">
                    {current.extraFields.map((f, i) => (
                      <div
                        key={`${f.label}-${i}`}
                        className="flex flex-col gap-0.5 px-3 py-2"
                      >
                        <dt className="text-[11px] text-muted-foreground">
                          {f.label}
                        </dt>
                        <dd className="text-sm break-words">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            ) : null}

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
                <div className="flex flex-col gap-1.5">
                  <HighlightedTextarea
                    autoFocus
                    value={logText}
                    highlight={logDetected}
                    onChange={(e) => setLogText(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter saves; Shift+Enter starts a new line for a longer note.
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        quickAdd();
                      }
                    }}
                    placeholder="e.g. Coffee yesterday, talked pilot…"
                    className="min-h-20"
                  />
                  {logDetected ? (
                    <p className="flex items-center gap-1.5 px-0.5 text-xs text-muted-foreground">
                      <Icons.calendar className="size-3.5 text-primary" />
                      Dated{" "}
                      <span className="font-medium text-foreground">
                        {formatInteractionWhen(logDetected.iso)}
                      </span>{" "}
                      — drops from your note
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={() => setDetailsOpen(true)}
                    >
                      <Icons.plus className="size-3.5" /> Add date &amp; type
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={quickAdd}
                      disabled={!logText.trim()}
                    >
                      <Icons.check className="size-4" /> Add
                    </Button>
                  </div>
                </div>
              ) : null}
              {mergedTimeline.length > 0 ? (
                <ol className="flex flex-col gap-2">
                  {mergedTimeline.map((entry) => {
                    if (entry.kind === "email") {
                      return (
                        <EmailThreadItem key={entry.thread.id} thread={entry.thread} />
                      );
                    }
                    const { item, index } = entry;
                    const Icon = item.type
                      ? Icons[interactionTypeIcon[item.type]]
                      : Icons.message;
                    // Header: the touchpoint type; the note becomes the body
                    // paragraph. Older free-text entries have no type, so they
                    // read as a generic "Interaction" over their note.
                    const title = item.type ?? "Interaction";
                    const when =
                      formatInteractionWhen(item.date, item.until) ?? item.when;
                    return (
                      <li
                        key={`log-${index}`}
                        className="group flex flex-col gap-1.5 rounded-md border border-border bg-card px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                            <Icon className="size-3.5" />
                          </span>
                          <span className="truncate text-sm font-medium">
                            {title}
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {when}
                          </span>
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              aria-label="Edit interaction"
                              onClick={() => editLog(index)}
                              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                            >
                              <Icons.edit className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Delete interaction"
                              onClick={() => deleteLog(index)}
                              className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                            >
                              <Icons.x className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        {item.label ? (
                          <p className="text-sm leading-snug text-muted-foreground whitespace-pre-wrap">
                            {item.label}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
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

      <LogInteractionDialog
        connectionName={current.name}
        open={detailsOpen}
        onOpenChange={(o) => {
          setDetailsOpen(o);
          if (!o) setEditingLog(null);
        }}
        onSubmit={
          editingLog != null
            ? (entry) => updateLog(editingLog, entry)
            : addLog
        }
        initialNote={editingLog != null ? "" : logText}
        initialDetailsOpen
        initialEntry={
          editingLog != null ? current.timeline[editingLog] : undefined
        }
      />
    </>
  );
}
