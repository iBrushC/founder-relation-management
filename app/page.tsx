import Link from "next/link";
import { Icons } from "@/lib/icons";
import { updates, connections, projects } from "@/lib/data";
import { PageHeader, PageBody, Section } from "@/components/app/layout-bits";
import { UpdateRow, ProjectRow } from "@/components/app/rows";
import { ConnectionsView } from "@/components/app/connections-view";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const recent = [...connections].sort((a, b) => a.rank - b.rank);
  const openTasks = projects.reduce(
    (n, p) => n + p.tasks.filter((t) => !t.done).length,
    0,
  );

  return (
    <>
      <PageHeader
        title="Home"
        description={`Thursday, July 3 — ${recent.length} people to follow up with, ${openTasks} tasks open.`}
        actions={
          <Button>
            <Icons.plus className="size-4" /> Add connection
          </Button>
        }
      />

      <PageBody className="flex flex-col gap-9">
        <Section
          title="Updates"
          action={
            <span className="text-xs text-muted-foreground">Next 30 days</span>
          }
        >
          <div className="flex flex-col gap-1.5">
            {updates.map((u) => (
              <UpdateRow key={u.id} update={u} />
            ))}
          </div>
        </Section>

        <Section
          title="Connections"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/connections">
                See all <Icons.arrowUpRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          <ConnectionsView connections={recent} />
        </Section>

        <Section
          title="Projects"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/projects">
                See all <Icons.arrowUpRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          <div className="flex flex-col gap-2">
            {projects.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </div>
        </Section>
      </PageBody>
    </>
  );
}
