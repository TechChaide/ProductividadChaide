
import { SidebarProvider } from "@/components/ui/sidebar";
import Header from "./components/header";
import Sidebar from "./components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full flex-row bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col m-0">
          {/* <Header /> */}
          <main className="flex-1 overflow-y-auto p-4">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
