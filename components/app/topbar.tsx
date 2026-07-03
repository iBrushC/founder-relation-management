"use client";

import { useState } from "react";
import { Icons } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GeneralAdd } from "@/components/app/general-add";

/** App-wide top bar: a centered global search plus quick actions. */
export function TopBar() {
  const [query, setQuery] = useState("");

  return (
    <header className="z-20 grid h-14 shrink-0 grid-cols-[1fr_minmax(0,32rem)_1fr] items-center gap-4 border-b border-border bg-background/85 px-6 backdrop-blur-sm">
      <div />

      <div className="relative">
        <Icons.search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, projects, notes…"
          aria-label="Search"
          className="h-9 pl-9"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <GeneralAdd />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="text-muted-foreground"
        >
          <Icons.bell className="size-[18px]" />
        </Button>
      </div>
    </header>
  );
}
