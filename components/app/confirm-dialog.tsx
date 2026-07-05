"use client";

import { useState } from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * A small confirmation dialog for destructive actions. By default it's a plain
 * Confirm/Cancel; pass `confirmPhrase` to require the user to type an exact word
 * (e.g. "DELETE") before the confirm button unlocks — used for the heavier wipes.
 *
 * `onConfirm` may be async; the button shows a pending state until it settles and
 * the dialog closes on success.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  confirmPhrase,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  confirmPhrase?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const phraseOk = !confirmPhrase || typed.trim() === confirmPhrase;

  // Reset the typed phrase whenever the dialog opens or closes.
  function change(next: boolean) {
    if (!busy) {
      setTyped("");
      onOpenChange(next);
    }
  }

  async function confirm() {
    if (!phraseOk || busy) return;
    setBusy(true);
    try {
      await onConfirm();
      setTyped("");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md tone-red">
              <Icons.trash className="size-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {confirmPhrase ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-phrase" className="text-xs text-muted-foreground">
              Type <span className="font-semibold text-foreground">{confirmPhrase}</span>{" "}
              to confirm
            </Label>
            <Input
              id="confirm-phrase"
              autoFocus
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirm();
              }}
              placeholder={confirmPhrase}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => change(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirm}
            disabled={!phraseOk || busy}
          >
            {busy ? "Deleting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
