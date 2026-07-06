"use client";

import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { toneInk } from "@/lib/tone";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Table-row actions shared by the list views (connections, events): a few
 * frequently-used controls promoted inline, with the rest (Remove) tucked into a
 * dropdown. Each inline action stops row-click propagation so a click doesn't
 * also open the row's detail panel.
 */

export type RowAction = {
  icon: (typeof Icons)[keyof typeof Icons];
  label: string;
  /** Omit for a stubbed control — the click is swallowed and nothing runs. */
  onClick?: () => void;
};

export function IconAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: (typeof Icons)[keyof typeof Icons];
  label: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={label}>
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function RowActions({
  actions,
  onRemove,
  removeLabel = "Remove",
}: {
  actions: RowAction[];
  onRemove: () => void;
  removeLabel?: string;
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const handle = (fn?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn?.();
  };
  return (
    <div className="flex items-center justify-end gap-0.5 text-muted-foreground">
      {actions.map((a) => (
        <IconAction
          key={a.label}
          icon={a.icon}
          label={a.label}
          onClick={handle(a.onClick)}
        />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={stop}
            aria-label="More actions"
          >
            <Icons.dots className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop}>
          <DropdownMenuItem
            className={cn("focus:bg-destructive/10", toneInk.red)}
            onSelect={onRemove}
          >
            <Icons.x className="size-4" /> {removeLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
