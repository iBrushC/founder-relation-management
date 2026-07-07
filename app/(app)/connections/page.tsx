import { listConnections, listProjects } from "@/lib/data/crm";
import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { ConnectionsView } from "@/components/app/connections-view";
import { AddConnectionDialog } from "@/components/app/add-dialogs";
import { ImportConnectionsDialog } from "@/components/app/import-connections-dialog";
import { ConnectionsProvider } from "@/components/app/list-contexts";
import { projectLinksByConnection } from "@/lib/data/project-links";

export default async function ConnectionsPage() {
  const [connections, projects] = await Promise.all([
    listConnections(),
    listProjects(),
  ]);
  const connectionProjects = projectLinksByConnection(projects);

  return (
    <ConnectionsProvider server={connections}>
      <PageHeader
        title="Connections"
        description="Everyone you're keeping up with, most recent first."
        actions={
          <div className="flex items-center gap-1">
            <ImportConnectionsDialog />
            <AddConnectionDialog />
          </div>
        }
      />
      <PageBody>
        <ConnectionsView showControls connectionProjects={connectionProjects} />
      </PageBody>
    </ConnectionsProvider>
  );
}
