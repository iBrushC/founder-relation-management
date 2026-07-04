"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/lib/icons";
import { seedSampleData } from "@/lib/data/actions";
import { Button } from "@/components/ui/button";

/**
 * Fills the signed-in account with the Maya Chen sample dataset. Handy for a
 * fresh account — replaces the old hard-coded demo data with real, editable rows.
 */
export function SampleDataButton() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  function load() {
    setDone(false);
    startTransition(async () => {
      await seedSampleData();
      router.refresh();
      setDone(true);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {done ? (
        <span className="text-xs text-muted-foreground">Loaded.</span>
      ) : null}
      <Button variant="outline" size="sm" onClick={load} disabled={pending}>
        <Icons.sparkles className="size-3.5" />
        {pending ? "Loading…" : "Load sample data"}
      </Button>
    </div>
  );
}
