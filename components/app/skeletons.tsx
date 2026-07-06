import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading-state building blocks for `loading.tsx` route fallbacks. Each mirrors
 * the dimensions of the real component it stands in for, so when the streamed
 * page swaps in there's minimal layout shift — the data simply "pops in".
 */

/** Placeholder sized like a header's primary action button (e.g. Add …). */
export function ActionButtonSkeleton() {
  return <Skeleton className="h-9 w-32" />;
}

/** A bordered card row — mirrors `ProjectRow` / `UpdateRow`. */
export function CardRowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 rounded-md border border-border bg-card px-4 py-2.5">
      <Skeleton className="size-9 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <Skeleton className="hidden h-3 w-24 sm:block" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

/** A vertical stack of `CardRowSkeleton`s. */
export function CardRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <CardRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** A search + filter toolbar — mirrors `ListToolbar`. */
export function ToolbarSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-9 flex-1" />
      <Skeleton className="h-9 w-36" />
    </div>
  );
}

/** A toolbar plus a bordered table body — mirrors the connections / events views. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <ToolbarSkeleton />
      <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="ml-auto h-3 w-20" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
