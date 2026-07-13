"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

/**
 * The multi-line twin of {@link HighlightedInput}: a textarea that can highlight
 * one character range in place. A transparent textarea layers over a mirror div
 * that redraws the same text with the range wrapped in a <mark>. The textarea
 * keeps the real caret, selection, and focus ring; the mirror only paints the
 * glyphs (and the highlight) on top, tracking the textarea's *vertical* scroll so
 * long text stays aligned.
 *
 * The mirror must match the textarea's box + type metrics exactly (padding,
 * text size, wrapping), so the two strings sit glyph-for-glyph. Keep any extra
 * `className` limited to sizing (e.g. `min-h-24`) — it's applied to both layers.
 */
export function HighlightedTextarea({
  value,
  highlight,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, "value"> & {
  value: string;
  /** Range to highlight, or null for none. */
  highlight?: { start: number; end: number } | null;
}) {
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const mirrorRef = React.useRef<HTMLDivElement>(null);

  const syncScroll = () => {
    if (mirrorRef.current && inputRef.current) {
      mirrorRef.current.scrollTop = inputRef.current.scrollTop;
    }
  };
  // Keep alignment after programmatic value changes (recognizer edits, resets)
  // as well as user scrolls.
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
      <Textarea
        ref={inputRef}
        value={value}
        onScroll={syncScroll}
        // Hide the textarea's own glyphs (its box/caret/placeholder stay); the
        // mirror paints the visible text on top.
        className={cn("text-transparent caret-foreground", className)}
        {...props}
      />
      <div
        ref={mirrorRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden rounded-lg border border-transparent px-2.5 py-2 text-sm whitespace-pre-wrap break-words text-foreground",
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
