import { listConnections, listEvents } from "@/lib/data/crm";
import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { EventsView } from "@/components/app/events-view";
import { AddEventDialog } from "@/components/app/add-dialogs";

export default async function EventsPage() {
  const [events, connections] = await Promise.all([
    listEvents(),
    listConnections(),
  ]);
  const connectionsById = Object.fromEntries(connections.map((c) => [c.id, c]));

  return (
    <>
      <PageHeader
        title="Events"
        description="Mixers, demo days, and meetups — upcoming first, then recent."
        actions={<AddEventDialog />}
      />
      <PageBody>
        <EventsView
          events={events}
          connectionsById={connectionsById}
          showControls
        />
      </PageBody>
    </>
  );
}
