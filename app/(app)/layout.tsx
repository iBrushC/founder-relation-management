import { Sidebar } from "@/components/app/sidebar";
import { TopBar } from "@/components/app/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
