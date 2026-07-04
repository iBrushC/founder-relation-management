import { PageHeader, PageBody } from "@/components/app/layout-bits";
import { SettingsView } from "@/components/app/settings-view";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, notifications, integrations, and account."
      />
      <PageBody>
        <SettingsView />
      </PageBody>
    </>
  );
}
