import type { Interaction } from "@/lib/data";

export function Timeline({ items }: { items: Interaction[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? (
              <span className="absolute top-3 left-[5px] h-full w-px bg-border" />
            ) : null}
            <span className="relative mt-1 size-2.5 shrink-0 rounded-full border-2 border-primary bg-accent" />
            <div className="-mt-0.5 leading-tight">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.when}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
