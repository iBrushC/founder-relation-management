"use client";

import { Icons } from "@/lib/icons";
import type { Connection } from "@/lib/data";
import { InitialsAvatar, Tag } from "@/components/app/primitives";
import { Timeline } from "@/components/app/timeline";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function Field({
  icon: Icon,
  children,
}: {
  icon: (typeof Icons)[keyof typeof Icons];
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span>{children}</span>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="eyebrow">{title}</span>
      {children}
    </div>
  );
}

export function ConnectionPanel({
  connection,
  open,
  onOpenChange,
}: {
  connection: Connection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] gap-0 p-0 sm:max-w-[380px]">
        {connection ? (
          <>
            <SheetHeader className="gap-3 border-b border-border p-5">
              <div className="flex items-center gap-3">
                <InitialsAvatar
                  name={connection.name}
                  tone={connection.avatarTone}
                  className="size-11 text-sm"
                />
                <div className="min-w-0">
                  <SheetTitle className="font-sans text-base font-semibold">
                    {connection.name}
                  </SheetTitle>
                  <SheetDescription>
                    {connection.role} · {connection.company}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {connection.tags.map((t) => (
                  <Tag key={t.label} {...t} />
                ))}
              </div>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
              <Block title="Contact">
                <div className="flex flex-col">
                  <Field icon={Icons.mail}>{connection.email}</Field>
                  <Field icon={Icons.phone}>{connection.phone}</Field>
                  <Field icon={Icons.pin}>{connection.location}</Field>
                  <Field icon={Icons.cake}>Birthday · {connection.birthday}</Field>
                </div>
              </Block>

              <Block title="Notes">
                <p className="rounded-md bg-muted p-3 text-sm leading-relaxed text-foreground/90">
                  {connection.note}
                </p>
              </Block>

              <Block title="Recent">
                <Timeline items={connection.timeline} />
              </Block>
            </div>

            <SheetFooter className="flex-row gap-2 border-t border-border p-4">
              <Button className="flex-1">
                <Icons.mail className="size-4" /> Message
              </Button>
              <Button variant="secondary">
                <Icons.edit className="size-4" /> Log
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
