"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";
import { me } from "@/lib/data";
import { initials } from "@/lib/tone";

const nav = [
  { href: "/", label: "Home", icon: Icons.home },
  { href: "/connections", label: "Connections", icon: Icons.users },
  { href: "/projects", label: "Projects", icon: Icons.folder },
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

      <div className="mt-auto flex flex-col gap-0.5 px-3 pb-2">
        {(() => {
          const active = isActive(pathname, "/settings");
          return (
            <Link
              href="/settings"
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icons.settings className="size-[18px]" />
              Settings
            </Link>
          );
        })()}
      </div>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <span className="grid size-8 shrink-0 place-items-center rounded-full tone-slate text-xs font-semibold">
            {initials(me.name)}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-sidebar-foreground">
              {me.name}
            </div>
            <div className="truncate text-xs text-muted-foreground">{me.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
