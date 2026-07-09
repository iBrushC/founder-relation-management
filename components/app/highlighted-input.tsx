"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * A single-line text input that can highlight one character range in place — a
 * transparent input layered over a mirror div that redraws the same text with
 * the range wrapped in a <mark>. The input keeps the real caret, selection, and
 * focus ring; the mirror only paints the glyphs (and the highlight) on top.
 *
 * The mirror must match the input's box + type metrics exactly, so the two
 * strings sit glyph-for-glyph, and it tracks the input's horizontal scroll so
 * long text stays aligned. Keep any extra `className` limited to sizing (e.g.
 * `h-9`) — it's applied to both layers.
 */
export function HighlightedInput({
  value,
  highlight,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value"> & {
  value: string;
  /** Range to highlight, or null for none. */
  highlight?: { start: number; end: number } | null;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const mirrorRef = React.useRef<HTMLDivElement>(null);

  const syncScroll = () => {
    if (mirrorRef.current && inputRef.current) {
      mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };
  // Keep alignment after programmatic value changes (typing past the edge,
  // recognizer edits) as well as user scrolls.
  React.useEffect(syncScroll, [value, highlight]);

  const clamped =
    highlight &&
    highlight.start >= 0 &&
    highlight.end <= value.length &&
    highlight.start < highlight.end
      ? highlight
      : null;
  const before = clamped ? value.slice(0, clamped.start) : value;
  const marked = clamped ? value.slice(clamped.start, clamped.end) : "";
  const after = clamped ? value.slice(clamped.end) : "";

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onScroll={syncScroll}
        // Hide the input's own glyphs (its box/caret/placeholder stay); the
        // mirror paints the visible text on top.
        className={cn("text-transparent caret-foreground", className)}
        {...props}
      />
      <div
        ref={mirrorRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-lg border border-transparent px-2.5 py-1 text-base whitespace-pre text-foreground md:text-sm",
          className,
        )}
      >
        <span>
          {before}
          {marked ? (
            <mark className="rounded-sm bg-primary/25 text-foreground">
              {marked}
            </mark>
          ) : null}
          {after}
        </span>
      </div>
    </div>
  );
}
