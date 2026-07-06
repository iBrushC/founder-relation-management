import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { ActionButtonSkeleton, CardRowsSkeleton } from "@/components/app/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Ventures and campaigns you're actively working on."
        actions={<ActionButtonSkeleton />}
      />
      <PageBody>
        <CardRowsSkeleton count={5} />
      </PageBody>
    </>
  );
}
