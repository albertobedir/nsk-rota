import type { ReactNode } from "react";
import SidebarNav from "@/components/dashboard/sidebar-nav";
import TopBanner from "@/components/dashboard/top-banner";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <TopBanner />

      <div className="mx-auto flex flex-col lg:flex-row max-w-[1400px] gap-6 px-4 py-4">
        <aside className="hidden lg:block w-[280px] shrink-0">
          <SidebarNav />
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
