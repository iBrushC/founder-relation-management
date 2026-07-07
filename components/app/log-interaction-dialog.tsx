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
 * A small dialog for logging an interaction against a connection — a quick way to
 * record a touchpoint (type + date, optional end date and note) without opening
 * the connection's full edit form. `onSubmit` receives the built entry; the
 * caller is responsible for persisting it (optimistically, via the list).
 */
export function LogInteractionDialog({
  connectionName,
  open,
  onOpenChange,
  onSubmit,
}: {
  /** Whose interaction this is — shown in the dialog description for context. */
  connectionName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entry: Interaction) => void;
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
  onSubmit,
  onCancel,
}: {
  onSubmit: (entry: Interaction) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<InteractionType>("Coffee");
  const [date, setDate] = useState(todayIso());
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");

  const untilInvalid = Boolean(until) && Boolean(date) && until < date;
  const canSave = Boolean(date) && !untilInvalid;

  const submit = () => {
    if (!canSave) return;
    const cleanUntil = until && until > date ? until : undefined;
    onSubmit({
      type,
      date,
      until: cleanUntil,
      label: note.trim(),
      when: whenLabel(date, cleanUntil ?? ""),
    });
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="log-type" className="text-xs text-muted-foreground">
            Type
          </Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as InteractionType)}
          >
            <SelectTrigger id="log-type" className="w-full data-[size=default]:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERACTION_TYPES.map((t) => {
                const Icon = Icons[interactionTypeIcon[t]];
                return (
                  <SelectItem key={t} value={t}>
                    <span>
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
            <Label htmlFor="log-date" className="text-xs text-muted-foreground">
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
            <Label htmlFor="log-until" className="text-xs text-muted-foreground">
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="log-note" className="text-xs text-muted-foreground">
            Note <span className="opacity-70">· optional</span>
          </Label>
          <Input
            id="log-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. Talked pilot timeline…"
            className="h-9"
          />
        </div>
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
