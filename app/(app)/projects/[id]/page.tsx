import { notFound } from "next/navigation";
import { Icons } from "@/lib/icons";
import { getProject, listConnections } from "@/lib/data/crm";
import { PageHeader, PageBody, Section } from "@/components/app/layout-bits";
import { ConnectionsView } from "@/components/app/connections-view";
import { TaskList } from "@/components/app/task-list";
import { GanttTimeline } from "@/components/app/gantt-timeline";
import { StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, connections] = await Promise.all([
    getProject(id),
    listConnections(),
  ]);
  if (!project) notFound();

  const byId = new Map(connections.map((c) => [c.id, c]));
  const people = project.connectionIds
    .map((cid) => byId.get(cid))
    .filter((c) => c !== undefined);

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.summary}
        back={{ href: "/projects", label: "Projects" }}
        actions={
          <>
            <StatusBadge label={project.status.label} tone={project.status.tone} />
            <Button variant="outline">
              <Icons.edit className="size-4" /> Edit
            </Button>
            <Button variant="secondary">
              <Icons.plus className="size-4" /> Add task
            </Button>
          </>
        }
      />

      <PageBody className="flex flex-col gap-7">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {project.description}
        </p>

        <Section
          title="Connections"
          action={
            <Button variant="ghost" size="sm">
              <Icons.plus className="size-3.5" /> Link person
            </Button>
          }
        >
          <ConnectionsView connections={people} />
        </Section>

        <Section title="Tasks">
          <TaskList tasks={project.tasks} projectId={project.id} />
        </Section>

        <Section title="Timeline">
          <GanttTimeline phases={project.phases} />
        </Section>
      </PageBody>
    </>
  );
}
