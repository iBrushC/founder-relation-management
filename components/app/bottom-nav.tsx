"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icons } from "@/lib/icons";

const nav = [
  { href: "/dashboard", label: "Home", icon: Icons.home },
  { href: "/connections", label: "Connections", icon: Icons.users },
  { href: "/projects", label: "Projects", icon: Icons.folder },
  { href: "/events", label: "Events", icon: Icons.calendar },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex lg:hidden items-center justify-around border-t border-border bg-background/95 backdrop-blur-sm">
      {nav.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2.5 text-[10px] font-medium transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-[22px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
