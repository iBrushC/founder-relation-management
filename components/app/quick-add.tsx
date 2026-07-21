"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";
import { runQuickAdd } from "@/lib/data/quick-add-actions";
import { useProfile } from "@/lib/data/hooks";
import {
  planAllowsQuickAdd,
  planLabel,
  resolvePlan,
} from "@/lib/data/billing";

/**
 * AI Quick Add. A search-bar-style popover: type one line of plain language
 * ("Met Ramsey Shils for coffee"), and an agent files it — reading and writing
 * your CRM through tools in a single pass. It can only add or edit, never
 * delete.
 *
 * Submitting is fire-and-forget: the popover closes the moment you hit Enter and
 * the request runs in the background, so you can keep working (or fire off
 * another line) while the agent thinks. Every request reports back as a toast —
 * what landed on success, and on an ambiguous request the agent's question with
 * an Edit action that reopens this box with your original text intact.
 *
 * Gating: Free users see a disabled button with a lock icon; clicking opens an
 * upgrade popover. The server action is gated separately (lib/data/quick-add-
 * actions) so bypassing the UI still hits the wall.
 */

function Spinner() {
  return (
    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

export function QuickAdd() {
  const { toast } = useToast();
  const { profile } = useProfile();
  const plan = resolvePlan(profile?.settings);
  const allowed = planAllowsQuickAdd(plan);

  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [text, setText] = useState("");
  // Requests currently in flight. Several can overlap — each is independent.
  const [pending, setPending] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** Reopen the box carrying a line forward, for the toast's Edit/Retry. */
  const openWith = useCallback((value: string) => {
    setText(value);
    setOpen(true);
  }, []);

  // Focus the field when the popover opens, and put the caret at the end so a
  // line handed back by a toast is ready to amend rather than overwrite.
  useEffect(() => {
    if (!open) return;
    const el = inputRef.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [open]);

  // Close on click outside. Dismissing keeps the draft — only submitting clears
  // it, so a stray click never costs you a half-typed note.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  /** Run one line to completion in the background and report it as a toast. */
  const run = useCallback(
    async (clean: string) => {
      setPending((n) => n + 1);
      try {
        const res = await runQuickAdd(clean);

        if (!res.ok) {
          toast({
            variant: "error",
            title: "Couldn't add that",
            description: res.error,
            action: { label: "Try again", onClick: () => openWith(clean) },
          });
          return;
        }

        const result = res.data!;

        // Nothing written — the agent asked a question or declined (e.g. a
        // delete). Hand the line back so it can be rephrased.
        if (result.applied.length === 0) {
          toast({
            variant: "info",
            title: "Quick Add needs a hand",
            description: result.message,
            action: { label: "Edit", onClick: () => openWith(clean) },
          });
          return;
        }

        toast({
          variant: "success",
          title:
            result.applied.length > 1
              ? `Added ${result.applied.length} things`
              : "Added to your CRM",
          description: result.applied.join(" · "),
        });
      } finally {
        setPending((n) => n - 1);
      }
    },
    [toast, openWith],
  );

  /** Hand the line to the background and get out of the way immediately. */
  function submit() {
    const clean = text.trim();
    if (!clean) return;
    setText("");
    setOpen(false);
    void run(clean);
  }

  if (!allowed) {
    return (
      <Popover open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled
            aria-disabled="true"
            title="Upgrade to use Quick Add"
            className="opacity-60"
          >
            <Icons.lock className="size-4" />
            Quick Add
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <div className="flex flex-col gap-2 p-1">
            <div className="flex items-center gap-2">
              <Icons.sparkles className="size-4 text-primary" />
              <div className="text-sm font-semibold">
                Quick Add is a paid feature
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You&apos;re on the {planLabel.free} plan. Upgrade to Quick or Grow
              to log contacts, interactions, and outreach in plain language.
            </p>
            <div className="mt-1 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUpgradeOpen(false)}
              >
                Not now
              </Button>
              <Button asChild size="sm">
                <Link
                  href="/settings#plan"
                  onClick={() => setUpgradeOpen(false)}
                >
                  Upgrade in Settings
                </Link>
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <Button onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {pending > 0 ? <Spinner /> : <Icons.sparkles className="size-4" />}
        Quick Add
        {pending > 1 ? (
          <span className="tabular-nums opacity-70">{pending}</span>
        ) : null}
        <span aria-live="polite" className="sr-only">
          {pending > 0 ? `${pending} quick add in progress` : ""}
        </span>
      </Button>

      {open ? (
        <div className="absolute top-full right-0 z-30 mt-2 w-96 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-2 border-b border-border p-2"
          >
            <div className="flex items-start gap-2">
              <Icons.sparkles className="mt-2 size-4 shrink-0 text-primary" />
              <Textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  // Enter submits; Shift+Enter inserts a newline.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Met Jordan Ellis for coffee — investor, wants a follow-up next week."
                aria-label="Quick add"
                className="min-h-24 resize-none border-0 bg-transparent px-1 py-1.5 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
            <div className="flex items-center justify-end">
              <Button type="submit" size="sm" disabled={!text.trim()}>
                Add
              </Button>
            </div>
          </form>

          <p className="px-3 py-2.5 text-xs text-muted-foreground">
            {pending > 0
              ? `Filing ${pending === 1 ? "that" : `${pending} notes`} in the background — add another.`
              : "Add a contact, log a chat, or update outreach — in plain language."}
          </p>
        </div>
      ) : null}
    </div>
  );
}