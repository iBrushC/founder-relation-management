import { listConnections } from "@/lib/data/crm";
import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { ConnectionsView } from "@/components/app/connections-view";
import { AddConnectionDialog } from "@/components/app/add-dialogs";

export default async function ConnectionsPage() {
  const connections = await listConnections();

  return (
    <>
      <PageHeader
        title="Connections"
        description="Everyone you're keeping up with, most recent first."
        actions={<AddConnectionDialog />}
      />
      <PageBody>
        <ConnectionsView connections={connections} showControls />
      </PageBody>
    </>
  );
}
