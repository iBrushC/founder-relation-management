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
