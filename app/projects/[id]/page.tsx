import { notFound } from "next/navigation";
import { Icons } from "@/lib/icons";
import { projectsById, connectionsById } from "@/lib/data";
import { PageHeader, PageBody, Section } from "@/components/app/layout-bits";
import { ConnectionsView } from "@/components/app/connections-view";
import { TaskList } from "@/components/app/task-list";
import { Timeline } from "@/components/app/timeline";
import { StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = projectsById[id];
  if (!project) notFound();

  const people = project.connectionIds
    .map((cid) => connectionsById[cid])
    .filter(Boolean);

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.summary}
        back={{ href: "/projects", label: "Projects" }}
        actions={
          <>
            <StatusBadge label={project.status.label} tone={project.status.tone} />
            <Button variant="secondary">
              <Icons.plus className="size-4" /> Add task
            </Button>
          </>
        }
      />

      <PageBody className="flex flex-col gap-9">
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
          <TaskList tasks={project.tasks} />
        </Section>

        <Section title="Timeline">
          <div className="rounded-md border border-border bg-card p-5">
            <Timeline items={project.timeline} />
          </div>
        </Section>
      </PageBody>
    </>
  );
}

export function generateStaticParams() {
  return Object.keys(projectsById).map((id) => ({ id }));
}
