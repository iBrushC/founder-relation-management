import { cn } from "@/lib/utils";
import type { Tag as TagType, Tone } from "@/lib/data";
import { toneBg, initials } from "@/lib/tone";

/** Category tag — soft-filled, squared, minimal rounding. */
export function Tag({ label, tone }: TagType) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[5px] px-2 text-xs font-medium whitespace-nowrap",
        toneBg[tone],
      )}
    >
      {label}
    </span>
  );
}

/** Status badge — like a tag, but with a leading state dot. */
export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-[5px] px-2 text-xs font-medium whitespace-nowrap",
        toneBg[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

/** Overlapping stack of initials-avatars, with a "+N" chip past the limit. */
export function AvatarStack({
  people,
  limit = 3,
}: {
  people: { name: string; tone?: Tone }[];
  limit?: number;
}) {
  const shown = people.slice(0, limit);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5">
        {shown.map((p, i) => (
          <InitialsAvatar
            key={i}
            name={p.name}
            tone={p.tone}
            className="size-6 text-[10px] ring-2 ring-card"
          />
        ))}
      </div>
      {extra > 0 ? (
        <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

/**
 * One person in a stacked list — avatar, name, an optional secondary line, and a
 * trailing slot for whatever action the surface offers (remove, promote…).
 */
export function PersonRow({
  name,
  subtitle,
  tone,
  action,
}: {
  name: string;
  subtitle?: string;
  tone?: Tone;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2">
      <InitialsAvatar name={name} tone={tone} className="size-7 text-[10px]" />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-medium">{name}</div>
        {subtitle ? (
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Initials avatar in a soft tone ground. */
export function InitialsAvatar({
  name,
  tone = "green",
  className,
}: {
  name: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold select-none",
        toneBg[tone],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
