import { listConnections, listEvents } from "@/lib/data/crm";
import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { EventsView } from "@/components/app/events-view";
import { AddEventDialog } from "@/components/app/add-dialogs";
import { EventFinder } from "@/components/app/event-finder";
import { EventsProvider } from "@/components/app/list-contexts";

export default async function EventsPage() {
  const [events, connections] = await Promise.all([
    listEvents(),
    listConnections(),
  ]);
  const connectionsById = Object.fromEntries(connections.map((c) => [c.id, c]));

  return (
    <EventsProvider server={events}>
      <PageHeader
        title="Events"
        description="Mixers, demo days, and meetups — upcoming first, then recent."
        actions={<AddEventDialog />}
      />
      <PageBody className="flex flex-col gap-7">
        <EventFinder />
        <EventsView connectionsById={connectionsById} showControls />
      </PageBody>
    </EventsProvider>
  );
}
