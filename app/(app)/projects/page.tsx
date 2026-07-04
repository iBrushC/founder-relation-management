import { listProjects } from "@/lib/data/crm";
import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { ProjectRow } from "@/components/app/rows";
import { AddProjectDialog } from "@/components/app/add-dialogs";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <>
      <PageHeader
        title="Projects"
        description="Ventures and campaigns you're actively working on."
        actions={<AddProjectDialog />}
      />
      <PageBody>
        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
        </div>
      </PageBody>
    </>
  );
}
