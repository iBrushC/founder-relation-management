import { Sidebar } from "@/components/app/sidebar";
import { BottomNav } from "@/components/app/bottom-nav";
import { TopBar } from "@/components/app/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ToastProvider>
      <TooltipProvider delayDuration={200}>
        <div className="flex h-full">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="no-scrollbar flex-1 overflow-y-auto pb-16 lg:pb-0">{children}</main>
          </div>
        </div>
        <BottomNav />
      </TooltipProvider>
    </ToastProvider>
  );
}
