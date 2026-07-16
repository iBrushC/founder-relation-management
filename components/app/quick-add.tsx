"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { runQuickAdd } from "@/lib/data/quick-add-actions";
import type { QuickAddResult } from "@/lib/ai/quick-add";

/**
 * AI Quick Add. A search-bar-style popover: type one line of plain language
 * ("Met Ramsey Shils for coffee"), and an agent files it — reading and writing
 * your CRM through tools in a single pass. It can only add or edit, never
 * delete. When it files something we show exactly what landed; on an ambiguous
 * request it comes back with a question instead of guessing.
 */

type Phase =
  | { name: "idle" }
  | { name: "running" }
  | { name: "done"; result: QuickAddResult };

function Spinner() {
  return (
    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

export function QuickAdd() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const busy = phase.name === "running";

  const reset = useCallback(() => {
    setText("");
    setPhase({ name: "idle" });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  // Focus the field when the popover opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on click outside (but never mid-write).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (busy) return;
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, busy, close]);

  async function submit() {
    const clean = text.trim();
    if (!clean) return;
    setPhase({ name: "running" });
    const res = await runQuickAdd(clean);
    if (!res.ok) {
      toast({ variant: "error", title: "Couldn't add that", description: res.error });
      setPhase({ name: "idle" });
      return;
    }
    const result = res.data!;
    if (result.applied.length > 0) {
      toast({
        variant: "success",
        title:
          result.applied.length > 1
            ? `Added ${result.applied.length} things`
            : "Added to your CRM",
        description: result.applied[0],
      });
    }
    setPhase({ name: "done", result });
  }

  return (
    <div ref={rootRef} className="relative">
      <Button onClick={() => (open ? close() : setOpen(true))} aria-expanded={open}>
        <Icons.sparkles className="size-4" /> Quick Add
      </Button>

      {open ? (
        <div className="absolute top-full right-0 z-30 mt-2 w-96 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (phase.name !== "running") submit();
            }}
            className="flex flex-col gap-2 border-b border-border p-2"
          >
            <div className="flex items-start gap-2">
              <Icons.sparkles className="mt-2 size-4 shrink-0 text-primary" />
              <Textarea
                ref={inputRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  // Editing after a result starts a fresh request.
                  if (phase.name === "done") setPhase({ name: "idle" });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") close();
                  // Enter submits; Shift+Enter inserts a newline.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (phase.name !== "running") submit();
                  }
                }}
                disabled={busy}
                placeholder="Met Jordan Ellis for coffee — investor, wants a follow-up next week."
                aria-label="Quick add"
                className="min-h-24 resize-none border-0 bg-transparent px-1 py-1.5 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
            <div className="flex items-center justify-end">
              {busy ? (
                <span className="pr-1 text-muted-foreground">
                  <Spinner />
                </span>
              ) : (
                <Button type="submit" size="sm" disabled={!text.trim()}>
                  Add
                </Button>
              )}
            </div>
          </form>

          {phase.name === "done" ? (
            <Result result={phase.result} onClose={close} onAddMore={reset} />
          ) : (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">
              {busy
                ? "Filing that for you…"
                : "Add a contact, log a chat, or update outreach — in plain language."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Result({
  result,
  onClose,
  onAddMore,
}: {
  result: QuickAddResult;
  onClose: () => void;
  onAddMore: () => void;
}) {
  // Nothing written — the agent asked a question or declined (e.g. a delete).
  // Show its message and let the user rephrase.
  if (result.applied.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <p className="text-sm text-foreground">{result.message}</p>
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={onAddMore}>
            Edit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <ul className="flex flex-col gap-1.5">
        {result.applied.map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <Icons.checkCircle className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onAddMore}>
          Add another
        </Button>
        <Button size="sm" onClick={onClose}>
          <Icons.check className="size-4" />
          Done
        </Button>
      </div>
    </div>
  );
}
