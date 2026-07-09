"use client";

import { useEffect, useMemo, useState } from "react";
import { Icons } from "@/lib/icons";
import {
  INTERACTION_TYPES,
  interactionTypeIcon,
  type Interaction,
  type InteractionType,
} from "@/lib/data";
import {
  formatInteractionWhen,
  formatWhen,
  recognizeDateInText,
  todayIso,
} from "@/lib/data/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * A small dialog for logging an interaction against a connection. It's
 * text-first: type a quick note and go. "Add details" optionally reveals the
 * touchpoint type, date, and an end date for anyone who wants to be precise.
 * `onSubmit` receives the built entry; the caller persists it (optimistically,
 * via the list).
 */
export function LogInteractionDialog({
  connectionName,
  open,
  onOpenChange,
  onSubmit,
  initialNote = "",
  initialDetailsOpen = false,
  initialEntry,
}: {
  /** Whose interaction this is — shown in the dialog description for context. */
  connectionName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entry: Interaction) => void;
  /** Pre-fill the note (e.g. carried over from the panel's inline field). */
  initialNote?: string;
  /** Open with the details section already expanded. */
  initialDetailsOpen?: boolean;
  /**
   * When set, the dialog edits this existing interaction: every field is
   * prepopulated and `onSubmit` receives the revised entry (to replace it).
   */
  initialEntry?: Interaction;
}) {
  const editing = Boolean(initialEntry);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md tone-green">
              <Icons.message className="size-4" />
            </span>
            {editing ? "Edit interaction" : "Log interaction"}
          </DialogTitle>
          <DialogDescription>
            {connectionName
              ? `${editing ? "Update this" : "Record a"} touchpoint with ${connectionName}.`
              : `${editing ? "Update this" : "Record a"} touchpoint.`}
          </DialogDescription>
        </DialogHeader>

        {/* Remounts each time the dialog opens, re-seeding the fields. */}
        <InteractionForm
          initialEntry={initialEntry}
          initialNote={initialNote}
          initialDetailsOpen={initialDetailsOpen}
          submitLabel={editing ? "Save changes" : "Log interaction"}
          onCancel={() => onOpenChange(false)}
          onSubmit={(entry) => {
            onSubmit(entry);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function InteractionForm({
  initialEntry,
  initialNote,
  initialDetailsOpen,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  /** An existing interaction whose fields seed the form (edit mode). */
  initialEntry?: Interaction;
  initialNote: string;
  initialDetailsOpen: boolean;
  submitLabel: string;
  onSubmit: (entry: Interaction) => void;
  onCancel: () => void;
}) {
  // Editing an existing entry expands details so every stored field is visible
  // and adjustable; creating from the panel honours the passed-in flag.
  const [note, setNote] = useState(initialEntry?.label ?? initialNote);
  const [detailsOpen, setDetailsOpen] = useState(
    initialDetailsOpen || Boolean(initialEntry),
  );
  const [type, setType] = useState<InteractionType>(
    initialEntry?.type ?? "Coffee",
  );
  const [date, setDate] = useState(initialEntry?.date ?? todayIso());
  const [until, setUntil] = useState(initialEntry?.until ?? "");
  // Once the user picks a date by hand (or when we open onto an existing
  // entry's saved date), stop auto-driving the date from the note text.
  const [dateTouched, setDateTouched] = useState(Boolean(initialEntry));

  // Recognize a date phrase in the note ("coffee yesterday", "call Jun 3") and,
  // until the user overrides the date, keep the date field in step with it.
  const detected = useMemo(() => recognizeDateInText(note), [note]);
  useEffect(() => {
    if (dateTouched) return;
    setDate(detected ?? todayIso());
  }, [detected, dateTouched]);

  const untilInvalid = Boolean(until) && Boolean(date) && until < date;
  // Without details, a note is all we need. With details, a valid date carries it
  // (the note becomes optional — the type/date describe the interaction).
  const canSave = detailsOpen
    ? Boolean(date) && !untilInvalid
    : Boolean(note.trim());

  const submit = () => {
    if (!canSave) return;
    if (detailsOpen) {
      const cleanUntil = until && until > date ? until : undefined;
      onSubmit({
        type,
        date,
        until: cleanUntil,
        label: note.trim(),
        when: formatInteractionWhen(date, cleanUntil) ?? "Today",
      });
    } else {
      // Simple, fast path: just the free-text note. `date` is today unless the
      // note named one (recognized above), so the entry sorts and ages right.
      onSubmit({
        label: note.trim(),
        date,
        when: formatInteractionWhen(date) ?? "Today",
      });
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="log-note" className="text-xs text-muted-foreground">
            Interaction
          </Label>
          <Input
            id="log-note"
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. Coffee yesterday, talked pilot…"
            className="h-9"
          />
          {detected && !dateTouched ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icons.calendar className="size-3.5 text-primary" />
              Dated <span className="font-medium text-foreground">
                {formatWhen(detected)}
              </span>{" "}
              from your note
            </p>
          ) : null}
        </div>

        {detailsOpen ? (
          <div className="flex flex-col gap-4 rounded-md border border-border bg-muted/40 p-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="log-type" className="text-xs text-muted-foreground">
                Type
              </Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as InteractionType)}
              >
                <SelectTrigger
                  id="log-type"
                  className="w-full data-[size=default]:h-9"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map((t) => {
                    const Icon = Icons[interactionTypeIcon[t]];
                    return (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-4 text-muted-foreground" />
                          {t}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="log-date"
                  className="text-xs text-muted-foreground"
                >
                  Date
                </Label>
                <Input
                  id="log-date"
                  type="date"
                  value={date}
                  max={until || undefined}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setDateTouched(true);
                  }}
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="log-until"
                  className="text-xs text-muted-foreground"
                >
                  Until <span className="opacity-70">· optional</span>
                </Label>
                <Input
                  id="log-until"
                  type="date"
                  value={until}
                  min={date || undefined}
                  onChange={(e) => setUntil(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 self-start px-2 text-xs text-muted-foreground"
            onClick={() => setDetailsOpen(true)}
          >
            <Icons.plus className="size-3.5" /> Add details
          </Button>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!canSave}>
          <Icons.check className="size-4" /> {submitLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
