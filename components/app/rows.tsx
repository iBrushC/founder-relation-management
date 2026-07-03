import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { toneBg } from "@/lib/tone";
import type { Update, Project } from "@/lib/data";
import { Tag, StatusBadge } from "@/components/app/primitives";

export function UpdateRow({ update }: { update: Update }) {
  const Icon = Icons[update.icon];
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-md",
          toneBg[update.tone],
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {update.title}
      </span>
      <Tag label={update.kind} tone={update.tone} />
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {update.when}
      </span>
    </div>
  );
}

export function ProjectRow({ project }: { project: Project }) {
  const Icon = Icons[project.icon];
  const openTasks = project.tasks.filter((t) => !t.done).length;
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex items-center gap-3.5 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-md",
          toneBg[project.tone],
        )}
      >
        <Icon className="size-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{project.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {project.summary}
        </div>
      </div>

      <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
        <span className="flex items-center gap-1 tabular-nums">
          <Icons.users className="size-3.5" />
          {project.connectionIds.length}
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <Icons.checkCircle className="size-3.5" />
          {openTasks} open
        </span>
      </div>

      <StatusBadge label={project.status.label} tone={project.status.tone} />
      <Icons.chevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
    </Link>
  );
}
