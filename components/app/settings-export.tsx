"use client";

import { useState } from "react";
import { Icons } from "@/lib/icons";
import { exportData } from "@/lib/data/actions";
import { Section } from "@/components/app/layout-bits";
import { Button } from "@/components/ui/button";

/**
 * Settings → Export. Downloads the signed-in user's *real* data as JSON, fetched
 * on demand from the `exportData` server action (previously this shipped the
 * hard-coded demo dataset into the client bundle).
 */

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ExportData = Awaited<ReturnType<typeof exportData>>;

const EXPORTS: {
  title: string;
  description: string;
  file: string;
  pick: (data: ExportData) => unknown;
}[] = [
  {
    title: "All data",
    description: "Everything — people, projects, tasks, events, and notes.",
    file: "sfrm-export.json",
    pick: (d) => d,
  },
  {
    title: "People",
    description: "All your connections and their notes.",
    file: "sfrm-people.json",
    pick: (d) => d.connections,
  },
  {
    title: "Projects",
    description: "All projects with their tasks and timelines.",
    file: "sfrm-projects.json",
    pick: (d) => d.projects,
  },
];

export function ExportSection() {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(item: (typeof EXPORTS)[number]) {
    setBusy(item.title);
    try {
      const data = await exportData();
      downloadJSON(item.file, item.pick(data));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Export">
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {EXPORTS.map((item) => (
          <div
            key={item.title}
            className="flex items-center justify-between gap-6 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{item.title}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.description}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => run(item)}
              disabled={busy !== null}
            >
              <Icons.download className="size-3.5" />
              {busy === item.title ? "Exporting…" : "Export"}
            </Button>
          </div>
        ))}
      </div>
    </Section>
  );
}
