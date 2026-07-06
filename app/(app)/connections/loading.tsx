import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { ActionButtonSkeleton, TableSkeleton } from "@/components/app/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeader
        title="Connections"
        description="Everyone you're keeping up with, most recent first."
        actions={<ActionButtonSkeleton />}
      />
      <PageBody>
        <TableSkeleton rows={7} />
      </PageBody>
    </>
  );
}
