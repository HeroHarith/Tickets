import { ReactNode } from "react";
import { CenterSidebar } from "./center-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface CenterLayoutProps {
  children: ReactNode;
}

export function CenterLayout({ children }: CenterLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className={`h-full ${isMobile ? 'w-0' : 'w-64'} flex-shrink-0`}>
        <CenterSidebar />
      </div>
      <div className="flex-1 overflow-auto">
        <main className="h-full">
          {children}
        </main>
      </div>
    </div>
  );
}