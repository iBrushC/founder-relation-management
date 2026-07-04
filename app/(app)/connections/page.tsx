import { listConnections } from "@/lib/data/crm";
import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { ConnectionsView } from "@/components/app/connections-view";
import { AddConnectionDialog } from "@/components/app/add-dialogs";
import { ConnectionsProvider } from "@/components/app/list-contexts";

export default async function ConnectionsPage() {
  const connections = await listConnections();

  return (
    <ConnectionsProvider server={connections}>
      <PageHeader
        title="Connections"
        description="Everyone you're keeping up with, most recent first."
        actions={<AddConnectionDialog />}
      />
      <PageBody>
        <ConnectionsView showControls />
      </PageBody>
    </ConnectionsProvider>
  );
}
