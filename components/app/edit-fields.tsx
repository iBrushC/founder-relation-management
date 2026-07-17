"use client";

import { useState } from "react";
import { cn, matchAllTerms } from "@/lib/utils";
import { Icons, type IconKey } from "@/lib/icons";
import type { ExtraField, Tag as TagType, Tone } from "@/lib/data";
import { toneBg } from "@/lib/tone";
import { InitialsAvatar, PersonRow } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

/**
 * A labeled column wrapping any control — the one field wrapper shared by the
 * Add dialogs, the settings About form, and the inline edit surfaces. Pass an
 * optional `icon` (shown before the label) or extra `className` on the column.
 */
export function EditRow({
  label,
  htmlFor,
  icon: Icon,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  icon?: (typeof Icons)[keyof typeof Icons];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon className="size-3.5" /> : null}
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
                className="grid size-4 cursor-pointer place-items-center rounded-sm hover:bg-black/10"
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
                  "inline-flex h-6 cursor-pointer items-center gap-1 rounded-[5px] px-2 text-xs font-medium opacity-70 transition-opacity hover:opacity-100",
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

/**
 * The person fields the two pickers below read. `Connection` satisfies it
 * structurally, so callers can pass their connections straight through.
 */
export type PickerPerson = {
  id: string;
  name: string;
  role?: string;
  company?: string;
  avatarTone: Tone;
};

/** "Role · Company" — the secondary line under a person's name. */
function subtitleOf(p: PickerPerson): string {
  return [p.role, p.company].filter(Boolean).join(" · ");
}

/** The trigger shared by the pickers: an input-shaped button with a chevron. */
function PickerTrigger({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <PopoverTrigger
      role="combobox"
      aria-expanded={open}
      className={cn(
        "flex h-8 w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
        className,
      )}
    >
      {children}
      <Icons.chevronDown className="size-4 shrink-0 text-muted-foreground" />
    </PopoverTrigger>
  );
}

/**
 * Pick a single connection by typing — a search-as-you-type combobox over the
 * caller's people. `null` means "no one", and the list offers a Clear row to get
 * back there once someone is chosen.
 */
export function ConnectionCombobox({
  people,
  value,
  onChange,
  placeholder = "Search connections…",
  emptyLabel = "No one",
}: {
  people: PickerPerson[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  /** Shown on the trigger when nothing is selected. */
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = people.find((p) => p.id === value);

  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PickerTrigger open={open}>
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <InitialsAvatar
              name={selected.name}
              tone={selected.avatarTone}
              className="size-5 text-[9px]"
            />
            <span className="truncate">{selected.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{emptyLabel}</span>
        )}
      </PickerTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command filter={matchAllTerms} loop>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No connections match.</CommandEmpty>
            <CommandGroup>
              {value ? (
                <CommandItem
                  value="clear"
                  keywords={["none", "clear"]}
                  onSelect={() => pick(null)}
                >
                  <Icons.x className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Clear</span>
                </CommandItem>
              ) : null}
              {people.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  keywords={[p.name, subtitleOf(p)]}
                  onSelect={() => pick(p.id)}
                >
                  <InitialsAvatar
                    name={p.name}
                    tone={p.avatarTone}
                    className="size-6 text-[10px]"
                  />
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate">{p.name}</span>
                    {subtitleOf(p) ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {subtitleOf(p)}
                      </span>
                    ) : null}
                  </div>
                  {p.id === value ? (
                    <Icons.check className="size-4 text-primary" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Edit the people met at an event as one list, whether or not they're in
 * Connections. Searching offers matching connections; anything else can be added
 * by name as a plain guest, which keeps "met them at a mixer" a two-second entry
 * and leaves promoting them to a connection for later.
 */
export function GuestPicker({
  people,
  metIds,
  guests,
  onChange,
}: {
  /** Every connection available to pick. */
  people: PickerPerson[];
  /** Ids of the picked connections. */
  metIds: string[];
  /** Picked guests who aren't connections — plain names. */
  guests: string[];
  onChange: (next: { metIds: string[]; guests: string[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const picked = metIds
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is PickerPerson => Boolean(p));
  const unpicked = people.filter((p) => !metIds.includes(p.id));

  const draft = query.trim();
  // A name already on the list — as a connection or a guest — can't be added twice.
  const alreadyListed = [...picked.map((p) => p.name), ...guests].some(
    (n) => n.toLowerCase() === draft.toLowerCase(),
  );

  const addConnection = (id: string) => {
    onChange({ metIds: [...metIds, id], guests });
    setQuery("");
    setOpen(false);
  };

  const addGuest = () => {
    if (!draft || alreadyListed) return;
    onChange({ metIds, guests: [...guests, draft] });
    setQuery("");
    setOpen(false);
  };

  const removeButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      aria-label={`Remove ${label}`}
      onClick={onClick}
      className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-black/10"
    >
      <Icons.x className="size-3.5" />
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      {picked.length > 0 || guests.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {picked.map((p) => (
            <PersonRow
              key={p.id}
              name={p.name}
              subtitle={subtitleOf(p)}
              tone={p.avatarTone}
              action={removeButton(p.name, () =>
                onChange({ metIds: metIds.filter((id) => id !== p.id), guests }),
              )}
            />
          ))}
          {guests.map((name) => (
            <PersonRow
              key={name}
              name={name}
              subtitle="Not a connection"
              tone="slate"
              action={removeButton(name, () =>
                onChange({ metIds, guests: guests.filter((g) => g !== name) }),
              )}
            />
          ))}
        </div>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PickerTrigger open={open}>
          <span className="text-muted-foreground">Add someone…</span>
        </PickerTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
          <Command filter={matchAllTerms} loop>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search or type a name…"
            />
            <CommandList>
              {/* Only reachable when the draft can't be added as a guest either —
                  otherwise the add row below always matches. */}
              <CommandEmpty>
                {alreadyListed
                  ? "Already on the list."
                  : "Type a name to add someone."}
              </CommandEmpty>
              {unpicked.length > 0 ? (
                <CommandGroup heading="Connections">
                  {unpicked.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      keywords={[p.name, subtitleOf(p)]}
                      onSelect={() => addConnection(p.id)}
                    >
                      <InitialsAvatar
                        name={p.name}
                        tone={p.avatarTone}
                        className="size-6 text-[10px]"
                      />
                      <div className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate">{p.name}</span>
                        {subtitleOf(p) ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {subtitleOf(p)}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {/* Kept alongside any connection matches, not just when there are
                  none — the person you mean may be a namesake of one. */}
              {draft && !alreadyListed ? (
                <CommandGroup>
                  <CommandItem
                    value="add-guest"
                    keywords={[draft]}
                    onSelect={addGuest}
                  >
                    <Icons.plus className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate">
                      Add “<span className="font-medium">{draft}</span>” as a guest
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Edit a list of free-form `{ label, value }` details: stacked rows with remove,
 * plus a label + value input pair. Used for a connection's "additional
 * information" — anything worth keeping that isn't a fixed contact field.
 */
export function KeyValueEditor({
  value,
  onChange,
}: {
  value: ExtraField[];
  onChange: (fields: ExtraField[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");

  const add = () => {
    const l = label.trim();
    const v = detail.trim();
    if (!l || !v) return;
    onChange([...value, { label: l, value: v }]);
    setLabel("");
    setDetail("");
  };

  return (
    <div className="flex flex-col gap-2.5">
      {value.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {value.map((f, i) => (
            <div
              key={`${f.label}-${i}`}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[11px] text-muted-foreground">{f.label}</div>
                <div className="truncate text-sm">{f.value}</div>
              </div>
              <button
                type="button"
                aria-label={`Remove ${f.label}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-black/10"
              >
                <Icons.x className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Label"
          className="h-8 w-2/5 shrink-0"
        />
        <Input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Value"
          className="h-8 flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          onClick={add}
          disabled={!label.trim() || !detail.trim()}
          aria-label="Add detail"
        >
          <Icons.plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Edit a list of additional email addresses for one person.
 *
 * Separate from the primary `email` field rather than replacing it: the primary
 * is what the app displays, exports, and copies into outreach. These extras earn
 * their keep by widening Gmail matching — someone who emails from both a work
 * and a personal address should still land on one timeline.
 *
 * Duplicates and blanks are rejected on the way in; the save action normalises
 * (trim/lowercase/dedupe) again before storing, since this isn't a trust
 * boundary.
 */
export function EmailListEditor({
  value,
  primary,
  onChange,
  max = 10,
}: {
  value: string[];
  /** The primary address, so we can refuse to add it twice. */
  primary?: string;
  onChange: (emails: string[]) => void;
  max?: number;
}) {
  const [draft, setDraft] = useState("");

  const normalized = (s: string) => s.trim().toLowerCase();
  const taken = new Set([
    ...(primary ? [normalized(primary)] : []),
    ...value.map(normalized),
  ]);
  const candidate = normalized(draft);
  // A minimal shape check only. Real validation is "does Gmail match it", and
  // an over-strict regex would reject valid-but-unusual addresses.
  const looksLikeEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate);
  const canAdd = looksLikeEmail && !taken.has(candidate) && value.length < max;

  const add = () => {
    if (!canAdd) return;
    onChange([...value, candidate]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2.5">
      {value.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {value.map((address, i) => (
            <div
              key={`${address}-${i}`}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5"
            >
              <Icons.mail className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">{address}</span>
              <button
                type="button"
                aria-label={`Remove ${address}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-black/10"
              >
                <Icons.x className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {value.length < max ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="another@address.com"
            className="h-8 flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            onClick={add}
            disabled={!canAdd}
            aria-label="Add email address"
          >
            <Icons.plus className="size-4" />
          </Button>
        </div>
      ) : null}
      {draft.trim() && taken.has(candidate) ? (
        <p className="text-xs text-muted-foreground">
          That address is already on this person.
        </p>
      ) : null}
    </div>
  );
}
