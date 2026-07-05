"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icons, type IconKey } from "@/lib/icons";
import type { Tag as TagType, Tone } from "@/lib/data";
import { toneBg } from "@/lib/tone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Small building blocks shared by the inline-edit surfaces (connection/event
 * panels, project header). Each is a controlled component: it renders `value`
 * and reports edits through `onChange`, leaving persistence to the caller.
 */

/** The seven UI accent tones, in display order. */
export const TONES: Tone[] = [
  "green",
  "teal",
  "blue",
  "purple",
  "amber",
  "red",
  "slate",
];

/** A labeled column wrapping any control — matches the Add-dialog field style. */
export function EditRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
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

/** A row of tone swatches; the selected one gets a ring. */
export function TonePicker({
  value,
  onChange,
}: {
  value: Tone;
  onChange: (tone: Tone) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TONES.map((tone) => (
        <button
          key={tone}
          type="button"
          onClick={() => onChange(tone)}
          aria-label={tone}
          aria-pressed={value === tone}
          className={cn(
            "size-6 rounded-full ring-offset-2 ring-offset-background transition-shadow",
            toneBg[tone],
            value === tone
              ? "ring-2 ring-primary"
              : "ring-1 ring-border hover:ring-primary/40",
          )}
        />
      ))}
    </div>
  );
}

/** Curated icon choices for a project. */
const ICON_CHOICES: IconKey[] = [
  "folder",
  "sparkles",
  "target",
  "briefcase",
  "star",
  "flag",
  "users",
  "building",
  "globe",
  "calendar",
];

/** A compact grid of icon buttons; the selected one is highlighted. */
export function IconPicker({
  value,
  onChange,
}: {
  value: IconKey;
  onChange: (icon: IconKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ICON_CHOICES.map((key) => {
        const Icon = Icons[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-label={key}
            aria-pressed={value === key}
            className={cn(
              "grid size-8 place-items-center rounded-md border transition-colors",
              value === key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Edit a list of `{ label, tone }` tags: chips with remove, one-click picks from
 * tags used elsewhere, plus a labeled input and a color row for new tags. The
 * color picker sits on its own row (not inline with the name) so the swatches
 * have room to breathe.
 */
export function TagEditor({
  value,
  onChange,
  suggestions = [],
}: {
  value: TagType[];
  onChange: (tags: TagType[]) => void;
  /** Tags used elsewhere, offered as one-click picks. */
  suggestions?: TagType[];
}) {
  const [draft, setDraft] = useState("");
  const [tone, setTone] = useState<Tone>("green");

  const has = (label: string) =>
    value.some((t) => t.label.toLowerCase() === label.toLowerCase());

  const addTag = (tag: TagType) => {
    if (!tag.label || has(tag.label)) return;
    onChange([...value, tag]);
  };

  const add = () => {
    const label = draft.trim();
    if (!label || has(label)) return;
    addTag({ label, tone });
    setDraft("");
  };

  // Distinct suggestions (by label) that aren't already applied.
  const picks = suggestions.filter(
    (s, i) =>
      !has(s.label) &&
      suggestions.findIndex(
        (o) => o.label.toLowerCase() === s.label.toLowerCase(),
      ) === i,
  );

  return (
    <div className="flex flex-col gap-2.5">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t, i) => (
            <span
              key={`${t.label}-${i}`}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-[5px] pr-1 pl-2 text-xs font-medium",
                toneBg[t.tone],
              )}
            >
              {t.label}
              <button
                type="button"
                aria-label={`Remove ${t.label}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="grid size-4 place-items-center rounded-sm hover:bg-black/10"
              >
                <Icons.x className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {picks.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            Pick from existing
          </span>
          <div className="flex flex-wrap gap-1.5">
            {picks.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => addTag(t)}
                aria-label={`Add ${t.label}`}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-[5px] px-2 text-xs font-medium opacity-70 transition-opacity hover:opacity-100",
                  toneBg[t.tone],
                )}
              >
                <Icons.plus className="size-3" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a tag…"
          className="h-8"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Add tag"
        >
          <Icons.plus className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Color</span>
        <TonePicker value={tone} onChange={setTone} />
      </div>
    </div>
  );
}

/** Edit a plain string list (event organizers, guests): chips + add-on-Enter. */
export function ChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const item = draft.trim();
    if (!item || value.some((v) => v.toLowerCase() === item.toLowerCase())) return;
    onChange([...value, item]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex h-6 items-center gap-1 rounded-[5px] border border-border bg-muted pr-1 pl-2 text-xs font-medium"
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="grid size-4 place-items-center rounded-sm hover:bg-black/10"
              >
                <Icons.x className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-8"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Add"
        >
          <Icons.plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
