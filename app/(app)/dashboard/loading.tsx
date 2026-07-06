import { PageHeader, PageBody, Section } from "@/components/app/layout-bits";
import {
  ActionButtonSkeleton,
  CardRowsSkeleton,
} from "@/components/app/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeader
        title="Home"
        description="Your people, updates, and projects at a glance."
        actions={<ActionButtonSkeleton />}
      />

      <PageBody className="flex flex-col gap-7">
        <Section title="Updates">
          <CardRowsSkeleton count={3} />
        </Section>

        <Section title="Connections">
          <CardRowsSkeleton count={4} />
        </Section>

        <Section title="Projects">
          <CardRowsSkeleton count={3} />
        </Section>
      </PageBody>
    </>
  );
}
