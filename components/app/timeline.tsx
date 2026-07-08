import type { Interaction } from "@/lib/data";
import { formatInteractionWhen, sortInteractions } from "@/lib/data/format";

/**
 * Stacked-element timeline — each entry is its own card in the stack rather
 * than a single sequential track, since stages often overlap in time.
 */
export function Timeline({ items }: { items: Interaction[] }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {sortInteractions(items).map((item, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
        >
          <span className="h-7 w-1 shrink-0 rounded-full bg-primary/55" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-sm font-medium">{item.label}</div>
            <div className="text-xs text-muted-foreground">
              {formatInteractionWhen(item.date, item.until) ?? item.when}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
