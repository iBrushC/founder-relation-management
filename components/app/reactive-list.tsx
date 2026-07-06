"use client";

import {
  createContext,
  useCallback,
  useContext,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ActionResult } from "@/lib/data/result";
import { useToast } from "@/components/ui/toast";

/**
 * Optimistic + reactive list plumbing.
 *
 * The problem: our add/remove flows waited on a server round-trip (mutation +
 * `revalidatePath`) before the UI changed, which felt clunky. This makes them
 * *optimistic* — the row appears/leaves the instant you act — and *reactive* —
 * a minimal pop-in / pop-out marks the change (see `.sfrm-pop-*` in globals.css).
 *
 * `useReactiveList` owns the merged view: server rows, plus optimistic adds,
 * minus rows that are animating out. Adds use React's `useOptimistic`, so the
 * temporary row is handed off to the real server row atomically on commit — no
 * id-matching, no flicker. Removes hold the row mounted through its leave
 * animation, then fire the server action once the pop-out finishes.
 */

export type Keyed = { id: string };

type Op<T> =
  | { type: "add"; item: T }
  | { type: "remove"; id: string }
  | { type: "update"; item: T };

/**
 * A mutation to persist an optimistic change — typically a Server Action. It may
 * return an `ActionResult`; a `{ ok: false }` (or a thrown error) surfaces a
 * toast and lets the optimistic change revert. Kept permissive so callers can
 * still pass plain fire-and-forget thunks.
 */
type Action = () => Promise<unknown> | unknown;

/** Narrow an arbitrary action return value to a failed `ActionResult`. */
function failedResult(value: unknown): (ActionResult & { ok: false }) | null {
  return value !== null &&
    typeof value === "object" &&
    "ok" in value &&
    (value as ActionResult).ok === false
    ? (value as ActionResult & { ok: false })
    : null;
}

export type ReactiveList<T> = {
  /** Rows to render: server rows + optimistic adds − rows already removed. */
  items: T[];
  /** IDs playing their enter animation (only ever user-added rows). */
  enteringIds: ReadonlySet<string>;
  /** IDs playing their leave animation; still mounted until it ends. */
  exitingIds: ReadonlySet<string>;
  /** Show `optimistic` now, run `action`; the real row replaces it on commit. */
  add: (optimistic: T, action: Action) => void;
  /** Swap the row for `next` in place now, then run `action` to persist it. */
  update: (next: T, action: Action) => void;
  /** Start `id`'s leave animation; `action` fires when the pop-out ends. */
  remove: (id: string, action: Action) => void;
  /** Called by the leaving row once its pop-out animation finishes. */
  onExited: (id: string) => void;
};

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

/**
 * How long after `remove()` to commit the row's exit if `onAnimationEnd` never
 * fires. A backstop: some elements — notably table rows (`<tr>`) — don't
 * reliably emit `animationend` for the pop-out, which would otherwise strand the
 * row on screen and never run its server action (i.e. "delete does nothing").
 * Kept just past the 160ms pop-out so a real `animationend` still drives commit.
 */
const EXIT_COMMIT_MS = 190;

export function useReactiveList<T extends Keyed>(server: T[]): ReactiveList<T> {
  const [items, apply] = useOptimistic(server, (state: T[], op: Op<T>) => {
    switch (op.type) {
      case "add":
        return [op.item, ...state];
      case "remove":
        return state.filter((x) => x.id !== op.id);
      case "update":
        return state.map((x) => (x.id === op.item.id ? op.item : x));
    }
  });
  const [enteringIds, setEntering] = useState<ReadonlySet<string>>(new Set());
  const [exitingIds, setExiting] = useState<ReadonlySet<string>>(new Set());
  const removals = useRef(new Map<string, Action>());
  const [, startTransition] = useTransition();
  const { error: toastError } = useToast();

  /**
   * Run a mutation and surface any failure. A `{ ok: false }` result or a thrown
   * error shows a toast; because we never touched `server` on failure, the
   * optimistic op auto-reverts once the transition settles. Returns nothing —
   * the revert is what the UI observes.
   */
  const settle = useCallback(
    async (action: Action | undefined) => {
      try {
        const failure = failedResult(await action?.());
        if (failure) toastError("Couldn't save your changes", failure.error);
      } catch {
        toastError(
          "Couldn't save your changes",
          "Something went wrong. Please try again.",
        );
      }
    },
    [toastError],
  );

  const add = useCallback<ReactiveList<T>["add"]>(
    (optimistic, action) => {
      setEntering((s) => new Set(s).add(optimistic.id));
      startTransition(async () => {
        apply({ type: "add", item: optimistic });
        await settle(action);
        // Real row has arrived (or the optimistic one is reverting); drop the
        // temp's enter flag either way.
        setEntering((s) => without(s, optimistic.id));
      });
    },
    [apply, settle],
  );

  const update = useCallback<ReactiveList<T>["update"]>(
    (next, action) => {
      startTransition(async () => {
        apply({ type: "update", item: next });
        await settle(action);
      });
    },
    [apply, settle],
  );

  const onExited = useCallback<ReactiveList<T>["onExited"]>(
    (id) => {
      // Idempotent: `animationend` and the fallback timeout may both fire.
      if (!removals.current.has(id)) return;
      const action = removals.current.get(id);
      removals.current.delete(id);
      setExiting((s) => without(s, id));
      startTransition(async () => {
        apply({ type: "remove", id });
        await settle(action);
      });
    },
    [apply, settle],
  );

  const remove = useCallback<ReactiveList<T>["remove"]>(
    (id, action) => {
      removals.current.set(id, action);
      setExiting((s) => new Set(s).add(id));
      // Backstop: commit even if the row's element never fires `animationend`
      // (e.g. a `<tr>`). `onExited` is idempotent, so a later real event is a no-op.
      setTimeout(() => onExited(id), EXIT_COMMIT_MS);
    },
    [onExited],
  );

  return { items, enteringIds, exitingIds, add, update, remove, onExited };
}

const EMPTY: ReadonlySet<string> = new Set();

/**
 * A no-op list for surfaces without a provider (e.g. the project detail page's
 * people list). Renders items statically; mutations fire immediately with no
 * optimism or animation, preserving prior behavior.
 */
export function staticList<T extends Keyed>(items: T[]): ReactiveList<T> {
  return {
    items,
    enteringIds: EMPTY,
    exitingIds: EMPTY,
    add: (_optimistic, action) => void action(),
    update: (_next, action) => void action(),
    remove: (_id, action) => void action(),
    onExited: () => {},
  };
}

/**
 * Props to spread on a list row so it pops in when added and pops out when
 * removed. A plain helper (not a hook) — safe to call inside a `.map`. Merge
 * `className` with the row's own classes; `exiting` lets you suppress clicks
 * while it leaves.
 */
export function popProps<T extends Keyed>(list: ReactiveList<T>, id: string) {
  const exiting = list.exitingIds.has(id);
  const entering = list.enteringIds.has(id);
  return {
    exiting,
    className: exiting
      ? "sfrm-pop-out pointer-events-none"
      : entering
        ? "sfrm-pop-in"
        : undefined,
    onAnimationEnd: (e: React.AnimationEvent<HTMLElement>) => {
      if (e.animationName === "sfrm-pop-out") list.onExited(id);
    },
  };
}

/**
 * Build a typed list context so an Add control (in the page header) and its
 * table (in the page body) share one optimistic list across the DOM split.
 */
export function createListContext<T extends Keyed>() {
  const Ctx = createContext<ReactiveList<T> | null>(null);

  function Provider({
    server,
    children,
  }: {
    server: T[];
    children: React.ReactNode;
  }) {
    const value = useReactiveList<T>(server);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  /** Inside the provider. Throws if used outside it. */
  function useList(): ReactiveList<T> {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useList must be used within its list Provider");
    return ctx;
  }

  /** Returns the list if a provider is present, else null (for dual-use views). */
  function useOptional(): ReactiveList<T> | null {
    return useContext(Ctx);
  }

  return { Provider, useList, useOptional };
}
