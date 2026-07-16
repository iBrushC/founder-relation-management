"use client";

import { Icons } from "@/lib/icons";
import { StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";

/**
 * One row in Settings → Integrations. Purely presentational: it renders whatever
 * connection state it's handed and reports clicks upward. Lives in its own file
 * so both the real Google row (`google-integration-row.tsx`) and the still-stubbed
 * LinkedIn row in `settings-view.tsx` can use it.
 */
export function IntegrationRow({
  logo,
  name,
  description,
  connected,
  account,
  busy = false,
  disabled = false,
  onConnect,
  onDisconnect,
}: {
  logo: string;
  name: string;
  description: string;
  connected: boolean;
  /** Shown next to "Connected" — for Google, the linked account's email. */
  account: string;
  /** A connect/disconnect is in flight; both buttons hold still. */
  busy?: boolean;
  /** Not configurable at all (e.g. missing OAuth env) — explains itself via `description`. */
  disabled?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark from /public */}
        <img
          src={logo}
          alt={`${name} logo`}
          className="size-[18px] object-contain"
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{name}</div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {connected && account ? `Connected · ${account}` : description}
        </p>
      </div>
      {connected ? (
        <div className="flex items-center gap-2">
          <StatusBadge label="Connected" tone="green" />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={busy}
            onClick={onDisconnect}
          >
            {busy ? "Disconnecting…" : "Disconnect"}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={busy || disabled}
          onClick={onConnect}
        >
          <Icons.link className="size-3.5" />
          {busy ? "Connecting…" : "Connect"}
        </Button>
      )}
    </div>
  );
}
