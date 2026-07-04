"use client";

import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { removeProject } from "@/lib/data/actions";
import { ProjectRow } from "@/components/app/rows";
import { ProjectsList } from "@/components/app/list-contexts";
import { popProps } from "@/components/app/reactive-list";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The projects list, driven by its optimistic list context so a newly-created
 * project pops in immediately and a removed one pops out. The server rows arrive
 * via the context Provider on the page.
 */
export function ProjectsBoard() {
  const list = ProjectsList.useList();
  return (
    <div className="flex flex-col gap-2">
      {list.items.map((p) => {
        const pop = popProps(list, p.id);
        return (
          <div
            key={p.id}
            className={cn("group relative", pop.className)}
            onAnimationEnd={pop.onAnimationEnd}
          >
            <ProjectRow project={p} />
            <div className="absolute top-1/2 right-3 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="More actions"
                    className="bg-card"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Icons.dots className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem
                    className="tone-red-ink focus:bg-destructive/10"
                    onSelect={() =>
                      list.remove(p.id, () => removeProject(p.id))
                    }
                  >
                    <Icons.x className="size-4" /> Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
