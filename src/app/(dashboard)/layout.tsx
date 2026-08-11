import Sidebar from "@/components/layout/Sidebar";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <TooltipProvider>
        <div className="app-layout">
          <Sidebar />
          <main className="app-main">{children}</main>
        </div>
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </SessionProvider>
  );
}
