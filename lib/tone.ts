import type { OutreachStatus, Tone } from "@/lib/data";

export const toneBg: Record<Tone, string> = {
  red: "tone-red",
  amber: "tone-amber",
  blue: "tone-blue",
  green: "tone-green",
  purple: "tone-purple",
  teal: "tone-teal",
  slate: "tone-slate",
};

export const toneInk: Record<Tone, string> = {
  red: "tone-red-ink",
  amber: "tone-amber-ink",
  blue: "tone-blue-ink",
  green: "tone-green-ink",
  purple: "tone-purple-ink",
  teal: "tone-teal-ink",
  slate: "tone-slate-ink",
};

/** Tone for each outreach pipeline status (drives its status pill). */
export const outreachStatusTone: Record<OutreachStatus, Tone> = {
  "Not started": "slate",
  Sent: "blue",
  "Awaiting reply": "amber",
  Replied: "green",
  Closed: "slate",
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
