import { cn } from "@/lib/utils";
import { toneBg } from "@/lib/tone";
import type { Phase } from "@/lib/data";

const DAY_MS = 86_400_000;
const DAY_WIDTH = 22; // px per day on the horizontal axis
const TICK_EVERY = 7; // day interval between axis labels/gridlines
const TODAY = "2026-07-03";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Whole-day index (UTC) for an ISO date. */
function toDay(iso: string) {
  return Math.floor(Date.parse(iso) / DAY_MS);
}

/** "Jun 24" style label for a whole-day index. */
function fmtDay(day: number) {
  const d = new Date(day * DAY_MS);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/**
 * Gantt-style timeline — days run along the horizontal axis and each stage is
 * a block spanning its start → end date, so overlapping stages read at a glance.
 */
export function GanttTimeline({ phases }: { phases: Phase[] }) {
  if (phases.length === 0) return null;

  const starts = phases.map((p) => toDay(p.start));
  const ends = phases.map((p) => toDay(p.end));
  const min = Math.min(...starts);
  const max = Math.max(...ends);
  const totalDays = max - min + 1;
  const trackWidth = totalDays * DAY_WIDTH;

  const ticks: { day: number; left: number }[] = [];
  for (let d = min; d <= max; d += TICK_EVERY) {
    ticks.push({ day: d, left: (d - min) * DAY_WIDTH });
  }

  const todayDay = toDay(TODAY);
  const todayLeft =
    todayDay >= min && todayDay <= max
      ? (todayDay - min) * DAY_WIDTH
      : null;

  return (
    <div className="flex overflow-hidden rounded-md border border-border bg-card">
      {/* Fixed stage-name gutter */}
      <div className="w-36 shrink-0 border-r border-border">
        <div className="h-8 border-b border-border" />
        {phases.map((p) => (
          <div
            key={p.id}
            className="flex h-9 items-center truncate border-b border-border px-3 text-xs font-medium last:border-b-0"
          >
            {p.label}
          </div>
        ))}
      </div>

      {/* Scrollable day axis + bars */}
      <div className="flex-1 overflow-x-auto">
        <div className="relative" style={{ width: trackWidth }}>
          {/* Gridlines */}
          {ticks.map((t) => (
            <div
              key={`grid-${t.day}`}
              className="absolute top-0 bottom-0 w-px bg-border/60"
              style={{ left: t.left }}
            />
          ))}

          {/* Today marker */}
          {todayLeft !== null ? (
            <div
              className="absolute top-0 bottom-0 z-10 w-px bg-primary"
              style={{ left: todayLeft }}
            >
              <span className="absolute top-1 left-1 text-[10px] font-medium whitespace-nowrap text-primary">
                Today
              </span>
            </div>
          ) : null}

          {/* Axis header */}
          <div className="relative h-8 border-b border-border">
            {ticks.map((t) => (
              <span
                key={`tick-${t.day}`}
                className="absolute top-1/2 -translate-y-1/2 pl-1.5 text-[11px] whitespace-nowrap text-muted-foreground"
                style={{ left: t.left }}
              >
                {fmtDay(t.day)}
              </span>
            ))}
          </div>

          {/* One row per stage */}
          {phases.map((p) => {
            const left = (toDay(p.start) - min) * DAY_WIDTH;
            const width = (toDay(p.end) - toDay(p.start) + 1) * DAY_WIDTH;
            return (
              <div
                key={p.id}
                className="relative h-9 border-b border-border last:border-b-0"
              >
                <div
                  className={cn(
                    "absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-[5px] px-2 text-xs font-medium",
                    toneBg[p.tone],
                  )}
                  style={{ left, width }}
                  title={`${p.label} · ${fmtDay(toDay(p.start))} – ${fmtDay(toDay(p.end))}`}
                >
                  <span className="truncate">
                    {fmtDay(toDay(p.start))} – {fmtDay(toDay(p.end))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
