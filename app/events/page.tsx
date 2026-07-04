import { Icons } from "@/lib/icons";
import { events } from "@/lib/data";
import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { EventsView } from "@/components/app/events-view";
import { Button } from "@/components/ui/button";

export default function EventsPage() {
  const sorted = [...events].sort((a, b) => a.rank - b.rank);

  return (
    <>
      <PageHeader
        title="Events"
        description="Mixers, demo days, and meetups — upcoming first, then recent."
        actions={
          <Button>
            <Icons.plus className="size-4" /> Add event
          </Button>
        }
      />
      <PageBody>
        <EventsView events={sorted} showControls />
      </PageBody>
    </>
  );
}
