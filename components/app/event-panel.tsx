"use client";

import { Icons } from "@/lib/icons";
import type { EventItem } from "@/lib/data";
import { connectionsById } from "@/lib/data";
import { InitialsAvatar, StatusBadge } from "@/components/app/primitives";
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

/** One person met — a connection (with role) or a plain-text guest. */
function MetRow({ name, role, tone }: { name: string; role?: string; tone?: EventItem["avatarTone"] }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2">
      <InitialsAvatar name={name} tone={tone} className="size-7 text-[10px]" />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-medium">{name}</div>
        {role ? (
          <div className="truncate text-xs text-muted-foreground">{role}</div>
        ) : null}
      </div>
    </div>
  );
}

export function EventPanel({
  event,
  open,
  onOpenChange,
}: {
  event: EventItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] gap-0 p-0 sm:max-w-[380px]">
        {event ? (
          <>
            <SheetHeader className="gap-3 border-b border-border p-5">
              <div className="flex items-center gap-3">
                <InitialsAvatar
                  name={event.name}
                  tone={event.avatarTone}
                  className="size-11 text-sm"
                />
                <div className="min-w-0">
                  <SheetTitle className="font-sans text-base font-semibold">
                    {event.name}
                  </SheetTitle>
                  <SheetDescription>{event.where}</SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  label={event.upcoming ? "Upcoming" : "Past"}
                  tone={event.upcoming ? "blue" : "slate"}
                />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {event.when}
                </span>
              </div>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
              <Block title="Details">
                <div className="flex flex-col">
                  <Field icon={Icons.calendar}>{event.when}</Field>
                  <Field icon={Icons.pin}>{event.where}</Field>
                  <Field icon={Icons.users}>
                    {event.organizers.join(" · ")}
                  </Field>
                </div>
              </Block>

              <Block title="Who was met">
                {(() => {
                  const met = event.metIds
                    .map((id) => connectionsById[id])
                    .filter(Boolean);
                  const guests = event.metGuests ?? [];
                  if (met.length === 0 && guests.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        No one logged yet.
                      </p>
                    );
                  }
                  return (
                    <div className="flex flex-col gap-1.5">
                      {met.map((c) => (
                        <MetRow
                          key={c.id}
                          name={c.name}
                          role={`${c.role} · ${c.company}`}
                          tone={c.avatarTone}
                        />
                      ))}
                      {guests.map((name) => (
                        <MetRow key={name} name={name} tone="slate" />
                      ))}
                    </div>
                  );
                })()}
              </Block>

              <Block title="Notes">
                <p className="rounded-md bg-muted p-3 text-sm leading-relaxed text-foreground/90">
                  {event.note}
                </p>
              </Block>
            </div>

            <SheetFooter className="flex-row gap-2 border-t border-border p-4">
              <Button className="flex-1">
                <Icons.calendar className="size-4" /> Add to calendar
              </Button>
              <Button variant="secondary">
                <Icons.edit className="size-4" /> Edit
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
