import React from "react";
import Header from "@/components/common/layout/header";
import Sidebar from "@/components/common/layout/sidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 p-4">
          {children}
        </main>
      </div>
    </div>
  );
}