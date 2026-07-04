"use client";

import { useState } from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * "General Add" — a free-text capture box that (eventually) parses plain
 * language and updates the CRM. No functionality yet: it just collects text.
 */
export function GeneralAdd() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setText("");
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Icons.sparkles className="size-4" /> Quick Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.sparkles className="size-4 text-primary" /> Quick Add
          </DialogTitle>
          <DialogDescription>
            Jot anything in plain language — a new contact, a note, a follow-up —
            and we&apos;ll file it in the right place.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Met Jordan Ellis from Beacon Capital at the demo day — investor, wants a follow-up next week."
          className="min-h-28"
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button disabled={!text.trim()} onClick={() => setOpen(false)}>
            <Icons.sparkles className="size-4" /> Add to CRM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
