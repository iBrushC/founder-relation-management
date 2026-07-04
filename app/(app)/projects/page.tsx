import { listProjects } from "@/lib/data/crm";
import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { ProjectsBoard } from "@/components/app/projects-board";
import { AddProjectDialog } from "@/components/app/add-dialogs";
import { ProjectsProvider } from "@/components/app/list-contexts";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <ProjectsProvider server={projects}>
      <PageHeader
        title="Projects"
        description="Ventures and campaigns you're actively working on."
        actions={<AddProjectDialog />}
      />
      <PageBody>
        <ProjectsBoard />
      </PageBody>
    </ProjectsProvider>
  );
}
