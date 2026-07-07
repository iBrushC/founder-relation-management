"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import type { Connection } from "@/lib/data";
import { importConnections } from "@/lib/data/actions";
import {
  IMPORT_FIELDS,
  detectField,
  parseCsv,
  type ImportFieldKey,
  type ParsedCsv,
} from "@/lib/data/csv";
import { ConnectionsList } from "@/components/app/list-contexts";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Import contacts from a CSV in two steps: (1) drop/pick a file, (2) confirm the
 * column→field mapping. Because real exports are messy, mapping is manual —
 * `detectField` pre-fills the obvious columns and the user corrects the rest.
 *
 * The confirmed rows are added optimistically to the shared connections list
 * (they pop in immediately) behind a single `importConnections` server action;
 * a failure reverts the whole batch and surfaces a toast (via the list plumbing).
 */

/** A per-column choice: a target field, or "skip" to leave the column out. */
type ColumnChoice = ImportFieldKey | "skip";

/** A client-only id for each optimistic row; the DB id replaces it on commit. */
function tempId(): string {
  return `optimistic-${crypto.randomUUID()}`;
}

export function ImportConnectionsDialog() {
  const list = ConnectionsList.useList();
  const { success } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  // One choice per CSV column, indexed by column position.
  const [choices, setChoices] = useState<ColumnChoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function reset() {
    setStep("upload");
    setFileName("");
    setParsed(null);
    setChoices([]);
    setError(null);
    setDragging(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const result = parseCsv(text);
      if (result.headers.length === 0) {
        setError("That file doesn't look like a CSV with a header row.");
        return;
      }
      if (result.rows.length === 0) {
        setError("No rows to import — the file only has a header.");
        return;
      }
      // Seed each column with its best-guess field (or "skip" if nothing fits).
      setChoices(result.headers.map((h) => detectField(h) ?? "skip"));
      setParsed(result);
      setStep("map");
    } catch {
      setError("Couldn't read that file. Please try another CSV.");
    }
  }

  // The first non-empty value in a column — shown as a preview under its header.
  const sampleFor = (colIndex: number): string => {
    if (!parsed) return "";
    for (const row of parsed.rows) {
      const v = (row[colIndex] ?? "").trim();
      if (v) return v;
    }
    return "";
  };

  const nameMapped = choices.includes("name");
  const willImport = useMemo(() => buildInputs(parsed, choices).length, [parsed, choices]);

  function setChoice(colIndex: number, value: ColumnChoice) {
    setChoices((prev) => prev.map((c, i) => (i === colIndex ? value : c)));
  }

  function runImport() {
    const inputs = buildInputs(parsed, choices);
    if (inputs.length === 0) return;

    const optimistic: Connection[] = inputs.map((input) => ({
      id: tempId(),
      name: input.name,
      role: input.role ?? "",
      company: input.company ?? "",
      avatarTone: "slate",
      tags: [],
      last: "Just now",
      rank: -1,
      email: input.email ?? "",
      phone: input.phone ?? "",
      location: input.location ?? "",
      linkedin: input.linkedin ?? "",
      birthday: "—",
      note: input.note ?? "",
      extraFields: [],
      timeline: [],
    }));

    list.addMany(optimistic, () => importConnections(inputs));
    success(
      `Imported ${inputs.length} ${inputs.length === 1 ? "contact" : "contacts"}`,
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <Icons.upload className="size-4" /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className={step === "map" ? "max-w-xl" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Upload a CSV — you'll confirm how its columns map next."
              : "Match each column to a contact field. We've guessed the obvious ones."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <div className="flex flex-col gap-3">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
                dragging
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-muted/60",
              )}
            >
              <Icons.upload className="size-6 text-muted-foreground" />
              <span className="text-sm font-medium">Click or drag a CSV here</span>
              <span className="text-xs text-muted-foreground">
                {fileName || "Your file stays in the browser until you import."}
              </span>
            </button>
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : null}
          </div>
        ) : null}

        {step === "map" && parsed ? (
          <div className="flex flex-col gap-3">
            <div className="max-h-[45vh] overflow-y-auto rounded-md border border-border">
              <ul className="divide-y divide-border">
                {parsed.headers.map((header, i) => {
                  const sample = sampleFor(i);
                  return (
                    <li
                      key={`${header}-${i}`}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {header || (
                            <span className="text-muted-foreground">
                              Column {i + 1}
                            </span>
                          )}
                        </p>
                        {sample ? (
                          <p className="truncate text-xs text-muted-foreground">
                            e.g. {sample}
                          </p>
                        ) : null}
                      </div>
                      <Icons.arrowUpRight className="size-3.5 shrink-0 rotate-45 text-muted-foreground" />
                      <Select
                        value={choices[i] ?? "skip"}
                        onValueChange={(v) => setChoice(i, v as ColumnChoice)}
                      >
                        <SelectTrigger className="h-8 w-40 shrink-0 data-[size=default]:h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          {IMPORT_FIELDS.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="skip">Don&apos;t import</SelectItem>
                        </SelectContent>
                      </Select>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              {!nameMapped ? (
                <span className="text-destructive">
                  Map at least one column to Name to continue.
                </span>
              ) : (
                `${willImport} ${willImport === 1 ? "contact" : "contacts"} ready to import${
                  willImport < parsed.rows.length
                    ? ` · ${parsed.rows.length - willImport} skipped (no name)`
                    : ""
                }.`
              )}
            </p>
          </div>
        ) : null}

        <DialogFooter>
          {step === "map" ? (
            <Button variant="ghost" onClick={reset}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === "map" ? (
            <Button disabled={!nameMapped || willImport === 0} onClick={runImport}>
              <Icons.plus className="size-4" /> Import {willImport || ""}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ImportInput = {
  name: string;
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  location?: string;
  note?: string;
};

/**
 * Turn the parsed grid + the confirmed column choices into import rows. Columns
 * sharing a field are joined (so "First Name" + "Last Name" → one Name), values
 * are trimmed, and rows with no resulting name are dropped.
 */
function buildInputs(parsed: ParsedCsv | null, choices: ColumnChoice[]): ImportInput[] {
  if (!parsed) return [];
  const out: ImportInput[] = [];

  for (const cells of parsed.rows) {
    const collected: Partial<Record<ImportFieldKey, string[]>> = {};
    choices.forEach((choice, i) => {
      if (choice === "skip") return;
      const value = (cells[i] ?? "").trim();
      if (!value) return;
      (collected[choice] ??= []).push(value);
    });

    const name = (collected.name ?? []).join(" ").trim();
    if (!name) continue;

    const join = (key: ImportFieldKey) => {
      const parts = collected[key];
      return parts && parts.length ? parts.join(" ").trim() : undefined;
    };
    out.push({
      name,
      role: join("role"),
      company: join("company"),
      email: join("email"),
      phone: join("phone"),
      linkedin: join("linkedin"),
      location: join("location"),
      note: join("note"),
    });
  }
  return out;
}
