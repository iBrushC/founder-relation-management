"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toneBg } from "@/lib/tone";
import type { Phase } from "@/lib/data";

const DAY_MS = 86_400_000;
/** Days visible in the default viewport; the rest scrolls horizontally. */
const VISIBLE_DAYS = 14;
/** Fallback px/day before the viewport width is measured. */
const FALLBACK_DAY_WIDTH = 24;
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
 * The viewport defaults to a 14-day window (days are sized so exactly 14 fit),
 * scrolls horizontally for longer projects, and opens centered on today.
 */
export function GanttTimeline({ phases }: { phases: Phase[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  // Track the scrollable viewport's width so 14 days can fill it exactly.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const starts = phases.map((p) => toDay(p.start));
  const ends = phases.map((p) => toDay(p.end));
  const min = phases.length ? Math.min(...starts) : 0;
  const max = phases.length ? Math.max(...ends) : 0;
  const totalDays = max - min + 1;

  const dayWidth =
    viewportWidth > 0 ? viewportWidth / VISIBLE_DAYS : FALLBACK_DAY_WIDTH;
  const trackWidth = totalDays * dayWidth;

  const todayDay = toDay(TODAY);
  const todayInRange = todayDay >= min && todayDay <= max;

  // Open scrolled so today (or the project start) sits near the left edge.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || viewportWidth === 0 || phases.length === 0) return;
    const anchor = todayInRange ? todayDay : min;
    const target = (anchor - min - 2) * dayWidth; // 2-day lead-in
    el.scrollLeft = Math.max(0, Math.min(target, trackWidth - viewportWidth));
  }, [viewportWidth, dayWidth, min, todayDay, todayInRange, trackWidth, phases.length]);

  if (phases.length === 0) return null;

  const ticks: { day: number; left: number }[] = [];
  for (let d = min; d <= max; d += TICK_EVERY) {
    ticks.push({ day: d, left: (d - min) * dayWidth });
  }

  const todayLeft = todayInRange ? (todayDay - min) * dayWidth : null;

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

      {/* Scrollable day axis + bars — defaults to a 14-day window */}
      <div ref={scrollRef} className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
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
            const left = (toDay(p.start) - min) * dayWidth;
            const width = (toDay(p.end) - toDay(p.start) + 1) * dayWidth;
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
