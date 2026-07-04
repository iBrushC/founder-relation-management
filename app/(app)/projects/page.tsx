import { Icons } from "@/lib/icons";
import { projects } from "@/lib/data";
import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { ProjectRow } from "@/components/app/rows";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Ventures and campaigns you're actively working on."
        actions={
          <Button>
            <Icons.plus className="size-4" /> New project
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
        </div>
      </PageBody>
    </>
  );
}
