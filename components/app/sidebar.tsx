"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { me } from "@/lib/data";
import { initials } from "@/lib/tone";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { href: "/", label: "Home", icon: Icons.home },
  { href: "/connections", label: "Connections", icon: Icons.users },
  { href: "/projects", label: "Projects", icon: Icons.folder },
  { href: "/events", label: "Events", icon: Icons.calendar },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <span className="grid size-7 place-items-center rounded-md bg-primary font-heading text-sm font-bold text-primary-foreground">
          S
        </span>
        <span className="font-heading text-sm font-bold tracking-tight text-sidebar-foreground">
          SFRM
        </span>
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors outline-none hover:bg-sidebar-accent/50 focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-expanded:bg-sidebar-accent/50"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full tone-slate text-xs font-semibold">
                {initials(me.name)}
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-medium text-sidebar-foreground">
                  {me.name}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {me.role}
                </div>
              </div>
              <Icons.dots className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width)"
          >
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Icons.settings className="size-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Icons.logout className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
