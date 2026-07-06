import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { ActionButtonSkeleton, TableSkeleton } from "@/components/app/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeader
        title="Events"
        description="Mixers, demo days, and meetups — upcoming first, then recent."
        actions={<ActionButtonSkeleton />}
      />
      <PageBody>
        <TableSkeleton rows={6} />
      </PageBody>
    </>
  );
}
