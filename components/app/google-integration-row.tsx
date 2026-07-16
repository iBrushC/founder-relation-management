"use client";

import { useEffect, useState } from "react";

import { useGoogleIntegration } from "@/lib/data/hooks";
import { disconnectGoogle } from "@/lib/data/integration-actions";
import { useToast } from "@/components/ui/toast";
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

export function GoogleIntegrationRow() {
  const { google, isLoading, mutate } = useGoogleIntegration();
  const { success, error: toastError } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    }
    return res;
  }

  const configured = google?.configured ?? true;

  return (
    <>
      <IntegrationRow
        logo="/google.png"
        name="Google"
        description={
          configured
            ? "Read your Gmail to log email as interactions."
            : "Unavailable — Google OAuth isn't configured on this deployment."
        }
        connected={google?.connected ?? false}
        account={google?.email ?? ""}
        busy={isLoading}
        disabled={!configured}
        onConnect={() => {
          // Full navigation, so the OAuth redirect chain works.
          window.location.href = "/api/integrations/google/connect";
        }}
        onDisconnect={() => setConfirmOpen(true)}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect Google?"
        description={
          google?.email
            ? `SFRM will stop reading mail from ${google.email}, and the access you granted will be revoked. Interactions already logged are kept.`
            : "SFRM will stop reading your mail, and the access you granted will be revoked. Interactions already logged are kept."
        }
        confirmLabel="Disconnect"
        onConfirm={handleDisconnect}
      />
    </>
  );
}
