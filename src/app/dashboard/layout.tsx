// import { SidebarProvider } from "@/components/ui/sidebar";
// import Header from "./components/header";
// import Sidebar from "./components/sidebar";

// export default function DashboardLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <SidebarProvider>
//       <div className="flex h-screen w-full flex-row bg-background">
//         <Sidebar />
//         <div className="flex flex-1 flex-col m-0">
//           {/* <Header /> */}
//           <main className="flex-1 overflow-y-auto p-4">
//             {children}
//           </main>
//         </div>
//       </div>
//     </SidebarProvider>
//   );
// }

// layout.tsx
import type { ReactNode } from "react";
import { DynamicSidebarMenu } from "@/components/dynamic-sidebar-menu";
import { Sidebar, SidebarFooter } from "@/components/ui/sidebar-new";
import { SidebarLogo } from "@/components/sidebar-logo";
import { CollaboratorsCard } from "@/components/collaborators-card";
import { Separator } from "@/components/ui/separator";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex w-full">
      <Sidebar>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4">
            <SidebarLogo />
          </div>
          
          {/* Menú - altura dinámica según contenido */}
          <div className="overflow-y-auto">
            <DynamicSidebarMenu />
          </div>
          
          {/* Separador */}
          <Separator className="bg-primary-foreground/20" />
          
          {/* Sección de colaboradores - crece hasta llenar espacio restante */}
          <div className="flex-1 flex flex-col px-3 py-2 overflow-hidden min-h-0">
            <CollaboratorsCard />
          </div>
        </div>
      </Sidebar>
      <main className="flex-1">{children}</main>
    </div>
  );
}
