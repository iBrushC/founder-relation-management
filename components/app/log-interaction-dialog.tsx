"use client";

import { useState } from "react";
import { Icons } from "@/lib/icons";
import {
  INTERACTION_TYPES,
  interactionTypeIcon,
  type Interaction,
  type InteractionType,
} from "@/lib/data";
import { formatMonthDay, formatWhen } from "@/lib/data/format";
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

/** Today's date as an ISO `YYYY-MM-DD` string (local time). */
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A human "when" label for a logged interaction, optionally spanning two dates. */
function whenLabel(date: string, until: string): string {
  if (!date) return "Just now";
  if (until && until > date) {
    return `${formatMonthDay(date)} – ${formatMonthDay(until)}`;
  }
  return formatWhen(date);
}

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
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md tone-green">
              <Icons.message className="size-4" />
            </span>
            Log interaction
          </DialogTitle>
          <DialogDescription>
            {connectionName
              ? `Record a touchpoint with ${connectionName}.`
              : "Record a touchpoint."}
          </DialogDescription>
        </DialogHeader>

        {/* Remounts each time the dialog opens, re-seeding the fields. */}
        <InteractionForm
          initialNote={initialNote}
          initialDetailsOpen={initialDetailsOpen}
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
  initialNote,
  initialDetailsOpen,
  onSubmit,
  onCancel,
}: {
  initialNote: string;
  initialDetailsOpen: boolean;
  onSubmit: (entry: Interaction) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState(initialNote);
  const [detailsOpen, setDetailsOpen] = useState(initialDetailsOpen);
  const [type, setType] = useState<InteractionType>("Coffee");
  const [date, setDate] = useState(todayIso());
  const [until, setUntil] = useState("");

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
        when: whenLabel(date, cleanUntil ?? ""),
      });
    } else {
      // Simple, fast path: just the free-text note, logged as "Just now".
      onSubmit({ label: note.trim(), when: "Just now" });
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
            placeholder="e.g. Coffee, talked pilot…"
            className="h-9"
          />
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
                  onChange={(e) => setDate(e.target.value)}
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
          <Icons.check className="size-4" /> Log interaction
        </Button>
      </DialogFooter>
    </>
  );
}
