import { cn } from "@/lib/utils";

/** A pulsing placeholder block. Compose these to mirror real content dimensions. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
