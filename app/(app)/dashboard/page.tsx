import Link from "next/link";
import { Icons } from "@/lib/icons";
import { listConnections, listProjects, listUpdates } from "@/lib/data/crm";
import { PageHeader, PageBody, Section } from "@/components/app/layout-bits";
import { ProjectRow } from "@/components/app/rows";
import { UpdatesView } from "@/components/app/updates-view";
import { ConnectionsView } from "@/components/app/connections-view";
import { AddConnectionDialog } from "@/components/app/add-dialogs";
import { ConnectionsProvider } from "@/components/app/list-contexts";
import { projectLinksByConnection } from "@/lib/data/project-links";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const [updates, connections, projects] = await Promise.all([
    listUpdates(),
    listConnections(),
    listProjects(),
  ]);

  const connectionsById = Object.fromEntries(connections.map((c) => [c.id, c]));
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const connectionProjects = projectLinksByConnection(projects);
  const openTasks = projects.reduce(
    (n, p) => n + p.tasks.filter((t) => !t.done).length,
    0,
  );

  return (
    <ConnectionsProvider server={connections}>
      <PageHeader
        title="Home"
        description={`${connections.length} people to keep up with, ${openTasks} tasks open.`}
        actions={<AddConnectionDialog />}
      />

      <PageBody className="flex flex-col gap-7">
        <Section
          title="Updates"
          action={
            <span className="text-xs text-muted-foreground">Next 30 days</span>
          }
        >
          <UpdatesView
            updates={updates}
            connectionsById={connectionsById}
            projectsById={projectsById}
          />
        </Section>

        <Section
          title="Connections"
          action={
            <div className="flex items-center gap-1">
              <AddConnectionDialog size="sm" variant="ghost" label="Add connection" />
              <Button asChild variant="ghost" size="sm">
                <Link href="/connections">
                  See all <Icons.arrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          }
        >
          <ConnectionsView connectionProjects={connectionProjects} />
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
    </ConnectionsProvider>
  );
}
