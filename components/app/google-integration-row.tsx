"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { relativeSince } from "@/lib/data/format";
import { useGoogleIntegration } from "@/lib/data/hooks";
import { disconnectGoogle } from "@/lib/data/integration-actions";
import { syncGmailNow } from "@/lib/data/gmail-actions";
import { Icons } from "@/lib/icons";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { IntegrationRow } from "@/components/app/integration-row";
import { ConfirmDialog } from "@/components/app/confirm-dialog";

/**
 * The Google integration row, wired to the real OAuth link.
 *
 * Connecting is a full-page navigation, not a fetch: the browser has to land on
 * Google's consent screen, so it can't be a server action or an XHR.
 */

/** Outcomes the OAuth callback reports back via `?google=`. */
const OUTCOME: Record<string, { variant: "success" | "error"; title: string; body?: string }> =
  {
    connected: { variant: "success", title: "Google connected" },
    denied: {
      variant: "error",
      title: "Google wasn't connected",
      body: "You cancelled at the consent screen.",
    },
    scope: {
      variant: "error",
      title: "Google wasn't connected",
      body: "SFRM needs permission to read your Gmail to log email as interactions. Please allow that when reconnecting.",
    },
    error: {
      variant: "error",
      title: "Couldn't connect Google",
      body: "Something went wrong linking your account. Please try again.",
    },
  };

/** What a completed sweep did, as a sentence. Reports zero honestly. */
function describeSync(s: {
  scanned: number;
  threads: number;
  matched: number;
  truncated: boolean;
}): string {
  if (s.scanned === 0) {
    return "None of your connections have an email address yet, so there was nothing to match.";
  }
  if (s.threads === 0) {
    return `No email found with any of your ${s.scanned} connections with an address.`;
  }
  const chains = `${s.threads} email ${s.threads === 1 ? "chain" : "chains"}`;
  const people = s.matched > 0 ? ` · ${s.matched} newly matched` : "";
  // Say so when the sweep hit its cap — silently truncating would read as
  // "that's all your mail" when it isn't.
  const capped = s.truncated
    ? " Some people had more email than one sync fetches; run it again later for older threads."
    : "";
  return `${chains}${people}.${capped}`;
}

export function GoogleIntegrationRow() {
  const { google, isLoading, mutate } = useGoogleIntegration();
  const { success, error: toastError } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  // The callback redirects to /settings?google=<outcome>. Read it once, report
  // it, then strip the param so a refresh doesn't replay the toast. Done via
  // window/history rather than useSearchParams so this component doesn't drag a
  // Suspense boundary into the settings page for a value it reads exactly once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("google");
    if (!outcome) return;

    const message = OUTCOME[outcome] ?? OUTCOME.error;
    if (message.variant === "success") {
      success(message.title, message.body);
      // The link changed server-side during the redirect — pull the new status.
      void mutate();
    } else {
      toastError(message.title, message.body);
    }

    params.delete("google");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );
  }, [success, toastError, mutate]);

  // Returned to ConfirmDialog rather than handled here: it owns the pending
  // state, closes on success, and keeps itself open on a failed result.
  async function handleDisconnect() {
    const res = await disconnectGoogle();
    if (res.ok) {
      success("Google disconnected");
      void mutate();
      // Disconnecting drops the mirrored threads, so any connection timeline
      // still on screen is now showing email that no longer exists.
      router.refresh();
    }
    return res;
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await syncGmailNow();
      if (res.ok && res.data) {
        success("Gmail synced", describeSync(res.data));
        // The action revalidated /connections server-side; refresh so an open
        // Settings page picks up the new "last synced" without a reload.
        void mutate();
        router.refresh();
      } else if (!res.ok) {
        toastError("Couldn't sync Gmail", res.error);
        // A dead grant is reported by the action *and* clears the stored row —
        // re-read so the row flips to "Connect" instead of lying.
        void mutate();
      }
    } finally {
      setSyncing(false);
    }
  }

  const configured = google?.configured ?? true;
  const connected = google?.connected ?? false;

  return (
    <>
      <div>
        <IntegrationRow
          logo="/google.png"
          name="Google"
          description={
            configured
              ? "Read your Gmail to log email as interactions."
              : "Unavailable — Google OAuth isn't configured on this deployment."
          }
          connected={connected}
          account={google?.email ?? ""}
          busy={isLoading}
          disabled={!configured}
          onConnect={() => {
            // Full navigation, so the OAuth redirect chain works.
            window.location.href = "/api/integrations/google/connect";
          }}
          onDisconnect={() => setConfirmOpen(true)}
        />
        {/*
          Sync is manual, so this is the only place the user can tell how fresh
          the mirrored threads are — and the only way to refresh them. Kept
          inside this wrapper rather than as a sibling because the Card is
          `divide-y`, and a sibling would render as its own integration.
        */}
        {connected ? (
          <div className="flex items-center gap-3 px-4 pb-3 pl-[62px]">
            <span className="text-xs text-muted-foreground">
              {google?.lastSyncedAt
                ? `Last synced ${relativeSince(google.lastSyncedAt)}`
                : "Not synced yet"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={syncing}
              onClick={handleSync}
            >
              <Icons.refresh
                className={`size-3.5${syncing ? " animate-spin" : ""}`}
              />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect Google?"
        description={
          google?.email
            ? `SFRM will stop reading mail from ${google.email}, and the access you granted will be revoked. Email synced from Gmail is removed; interactions you logged yourself are kept.`
            : "SFRM will stop reading your mail, and the access you granted will be revoked. Email synced from Gmail is removed; interactions you logged yourself are kept."
        }
        confirmLabel="Disconnect"
        onConfirm={handleDisconnect}
      />
    </>
  );
}
