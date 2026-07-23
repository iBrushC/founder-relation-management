import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sticky page header — Space Mono title, optional description + actions. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header>
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 lg:px-6 pt-4 lg:pt-6 pb-1">
        <div className="min-w-0">
          {back ? (
            <Link
              href={back.href}
              className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" /> {back.label}
            </Link>
          ) : null}
          <h1 className="font-heading text-lg leading-none font-bold tracking-tight uppercase">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

/** Content shell — centers page body and sets consistent vertical rhythm. */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-5xl px-4 lg:px-6 pt-3 pb-8", className)}>{children}</div>
  );
}

/** A titled section with an all-caps eyebrow and optional trailing action. */
export function Section({
  title,
  action,
  id,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  /** DOM id for the wrapping section, so deep-links can scroll to it. */
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <span className="eyebrow">{title}</span>
        <span className="h-px flex-1 bg-border" />
        {action}
      </div>
      {children}
    </section>
  );
}
