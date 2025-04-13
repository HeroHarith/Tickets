import React from "react";
import { Header } from "@/components/common/layout";
import { CenterSidebar } from "@/components/common/layout";

interface CenterLayoutProps {
  children: React.ReactNode;
}

export default function CenterLayout({ children }: CenterLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <CenterSidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 p-4">
          {children}
        </main>
      </div>
    </div>
  );
}