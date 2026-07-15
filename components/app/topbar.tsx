import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { QuickAdd } from "@/components/app/quick-add";
import { GlobalSearch } from "@/components/app/global-search";

/** App-wide top bar: a centered global search plus quick actions. */
export function TopBar() {
  return (
    <header className="z-20 grid h-14 shrink-0 grid-cols-[1fr_minmax(0,32rem)_1fr] items-center justify-center gap-4 border-b border-border bg-background/85 px-6 backdrop-blur-sm">
      <div />

      <GlobalSearch />

      <div className="flex items-center justify-end gap-2">
        <QuickAdd />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="text-muted-foreground"
        >
          <Icons.bell className="size-[18px]" />
        </Button>
      </div>
    </header>
  );
}
