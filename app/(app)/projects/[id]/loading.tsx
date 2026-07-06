import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageBody, Section } from "@/components/app/layout-bits";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <header>
        <div className="mx-auto flex max-w-5xl items-start gap-4 px-6 pt-6 pb-1">
          <div className="min-w-0 flex-1">
            <Link
              href="/projects"
              className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" /> Projects
            </Link>
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 shrink-0" />
              <Skeleton className="h-5 w-48" />
            </div>
            <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </header>

      <PageBody className="flex flex-col gap-7">
        <Section title="Connections">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-40 rounded-md" />
            ))}
          </div>
        </Section>

        <Section title="Tasks">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Section>

        <Section title="Timeline">
          <Skeleton className="h-40 w-full" />
        </Section>

        <Section title="Outreach">
          <Skeleton className="h-28 w-full" />
        </Section>
      </PageBody>
    </>
  );
}
