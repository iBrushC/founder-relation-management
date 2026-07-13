"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/lib/icons";
import type { IconKey } from "@/lib/icons";
import { useSearch } from "@/lib/data/hooks";
import type { SearchItem } from "@/lib/data/search";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const GROUPS: { type: SearchItem["type"]; heading: string; icon: IconKey }[] = [
  { type: "connection", heading: "People", icon: "user" },
  { type: "project", heading: "Projects", icon: "folder" },
  { type: "event", heading: "Events", icon: "calendar" },
];

/**
 * Match all whitespace-separated terms against the item's text (title, subtitle,
 * and hidden keywords), so "sam alder" finds "Sam Whitfield · Alder Ventures".
 * Runs entirely on the client over the prefetched index — instant as you type.
 */
function matches(_value: string, search: string, keywords?: string[]): number {
  const haystack = (keywords ?? []).join(" ").toLowerCase();
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  return terms.every((t) => haystack.includes(t)) ? 1 : 0;
}

/**
 * App-wide search. An inline combobox (shadcn `Command`) over the user's people,
 * projects, and events — selecting a result deep-links to it. The index is
 * fetched lazily the first time the field is used, then cached by SWR.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Only start loading the index once the user actually engages with search.
  const [enabled, setEnabled] = useState(false);
  const { items, isLoading } = useSearch(enabled);
  const rootRef = useRef<HTMLDivElement>(null);

  const focusInput = () => {
    rootRef.current
      ?.querySelector<HTMLInputElement>("[cmdk-input]")
      ?.focus();
  };

  // ⌘K / Ctrl+K focuses search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setEnabled(true);
        setOpen(true);
        focusInput();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the results panel when clicking outside the field.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const onSelect = (item: SearchItem) => {
    close();
    rootRef.current
      ?.querySelector<HTMLInputElement>("[cmdk-input]")
      ?.blur();
    router.push(item.href);
  };

  const showList = open && query.trim().length > 0;

  return (
    <Command
      ref={rootRef}
      filter={matches}
      shouldFilter
      loop
      className="relative overflow-visible justify-center"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        onFocus={() => {
          setEnabled(true);
          setOpen(true);
        }}
        placeholder="Search people, projects, notes…"
        aria-label="Search"
        wrapperClassName="h-9 rounded-lg border border-input bg-background px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        className="h-9 text-sm"
      />

      {showList ? (
        <div className="absolute top-full left-0 z-30 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <CommandList className="max-h-[min(24rem,60vh)]">
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching…
              </div>
            ) : (
              <CommandEmpty>No matches for “{query.trim()}”.</CommandEmpty>
            )}

            {GROUPS.map(({ type, heading, icon }) => {
              const groupItems = items.filter((i) => i.type === type);
              if (groupItems.length === 0) return null;
              const Icon = Icons[icon];
              return (
                <CommandGroup key={type} heading={heading}>
                  {groupItems.map((item) => (
                    <CommandItem
                      key={`${item.type}-${item.id}`}
                      value={`${item.type}-${item.id}`}
                      keywords={[item.title, item.subtitle, item.keywords]}
                      onSelect={() => onSelect(item)}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </div>
      ) : null}
    </Command>
  );
}
