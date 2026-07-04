import { Icons } from "@/lib/icons";
import { connections } from "@/lib/data";
import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { ConnectionsView } from "@/components/app/connections-view";
import { Button } from "@/components/ui/button";

export default function ConnectionsPage() {
  const sorted = [...connections].sort((a, b) => a.rank - b.rank);

  return (
    <>
      <PageHeader
        title="Connections"
        description="Everyone you're keeping up with, most recent first."
        actions={
          <Button>
            <Icons.plus className="size-4" /> Add connection
          </Button>
        }
      />
      <PageBody>
        <ConnectionsView connections={sorted} showControls />
      </PageBody>
    </>
  );
}
