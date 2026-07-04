import { notFound } from "next/navigation";
import { getProject, listConnections } from "@/lib/data/crm";
import { ProjectDetail } from "@/components/app/project-detail";

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
    <ProjectDetail
      project={project}
      people={people}
      allConnections={connections}
    />
  );
}
