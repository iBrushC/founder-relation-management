"use client";

import { Icons } from "@/lib/icons";
import { Input } from "@/components/ui/input";

/**
 * The search + filter + count header shared by the list views. `filter` is a
 * slot for the view-specific control (a tag select, a when select, …); `count`
 * is the right-aligned result tally.
 */
export function ListToolbar({
  query,
  onQuery,
  placeholder,
  filter,
  count,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  filter: React.ReactNode;
  count: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-56 flex-1">
        <Icons.search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="h-9 pl-8"
        />
      </div>
      {filter}
      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
        {count}
      </span>
    </div>
  );
}
