"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Icons } from "@/lib/icons"
import type { ActionResult } from "@/lib/data/result"

/**
 * App-wide toast notifications.
 *
 * A thin store on top of Radix Toast: `ToastProvider` mounts once (see the app
 * layout) and exposes an imperative API through `useToast()`. Mutations that now
 * return an `ActionResult` (see `lib/data/result.ts`) surface failures here
 * instead of silently reverting — that's the visible half of rec 1.
 */

type ToastVariant = "error" | "success" | "info"

type ToastOptions = {
  title: string
  description?: string
  variant?: ToastVariant
  /** Auto-dismiss delay in ms. Errors linger longer so they're not missed. */
  duration?: number
  /**
   * Optional follow-up the toast offers, e.g. reopening Quick Add on a request
   * the agent came back with a question about. Clicking it dismisses the toast.
   */
  action?: { label: string; onClick: () => void }
}

type ToastRecord = ToastOptions & { id: string; variant: ToastVariant }

type ToastApi = {
  toast: (opts: ToastOptions) => void
  error: (title: string, description?: string) => void
  success: (title: string, description?: string) => void
}

// A no-op default so a stray `useToast()` outside the provider degrades to
// "no toast shown" rather than throwing.
const noop: ToastApi = {
  toast: () => {},
  error: () => {},
  success: () => {},
}

const ToastContext = React.createContext<ToastApi>(noop)

const DEFAULT_DURATION = 5000
const ERROR_DURATION = 8000
// A toast worth acting on has to outlive a glance — you have to read it, decide,
// and reach for the mouse before it slides away.
const ACTION_DURATION = 12000

const chip: Record<ToastVariant, string> = {
  error: "tone-red",
  success: "tone-green",
  info: "tone-blue",
}

const icon: Record<ToastVariant, keyof typeof Icons> = {
  error: "x",
  success: "check",
  info: "bell",
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([])
  // Monotonic id source — avoids duplicate React keys without Date/Math.random.
  const seq = React.useRef(0)

  const remove = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const api = React.useMemo<ToastApi>(() => {
    const toast = (opts: ToastOptions) => {
      const id = `t${(seq.current += 1)}`
      setToasts((prev) => [...prev, { variant: "info", ...opts, id }])
    }
    return {
      toast,
      error: (title, description) => toast({ variant: "error", title, description }),
      success: (title, description) =>
        toast({ variant: "success", title, description }),
    }
  }, [])

  return (
    <ToastContext.Provider value={api}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => {
          const Icon = Icons[t.variant ? icon[t.variant] : "bell"]
          return (
            <ToastPrimitive.Root
              key={t.id}
              duration={
                t.duration ??
                (t.action
                  ? ACTION_DURATION
                  : t.variant === "error"
                    ? ERROR_DURATION
                    : DEFAULT_DURATION)
              }
              onOpenChange={(open) => {
                if (!open) remove(t.id)
              }}
              className={cn(
                "group pointer-events-auto flex w-full items-start gap-3 rounded-md border border-border bg-popover p-3 pr-8 text-sm text-popover-foreground shadow-lg bg-clip-padding",
                "relative data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-2",
                "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-2",
                "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-2",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                  chip[t.variant],
                )}
              >
                <Icon className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="font-medium">
                  {t.title}
                </ToastPrimitive.Title>
                {t.description ? (
                  <ToastPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                    {t.description}
                  </ToastPrimitive.Description>
                ) : null}
                {t.action ? (
                  <ToastPrimitive.Action asChild altText={t.action.label}>
                    <button
                      type="button"
                      onClick={t.action.onClick}
                      className="mt-2 rounded-sm text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t.action.label}
                    </button>
                  </ToastPrimitive.Action>
                ) : null}
              </div>
              <ToastPrimitive.Close
                aria-label="Dismiss"
                className="absolute top-2 right-2 rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus:outline-none"
              >
                <Icons.x className="size-3.5" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          )
        })}
        <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-[100] m-0 flex w-full max-w-sm list-none flex-col gap-2 p-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}

/** The imperative toast API. Safe to call anywhere under `ToastProvider`. */
export function useToast(): ToastApi {
  return React.useContext(ToastContext)
}

/**
 * Surface a mutation's `ActionResult` as a toast: shows the server's error
 * message on failure (optionally a success toast), and returns whether it
 * succeeded so the caller can branch (e.g. keep a dialog open). A missing
 * result (undefined) is treated as success — for void fire-and-forget actions.
 */
export function useMutationToast() {
  const { toast } = useToast()
  return React.useCallback(
    (
      result: ActionResult | void | undefined,
      opts?: { error?: string; success?: string },
    ): boolean => {
      if (result && result.ok === false) {
        toast({
          variant: "error",
          title: opts?.error ?? "Couldn't save your changes",
          description: result.error,
        })
        return false
      }
      if (opts?.success) toast({ variant: "success", title: opts.success })
      return true
    },
    [toast],
  )
}
