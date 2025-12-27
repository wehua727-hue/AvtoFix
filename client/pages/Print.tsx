import Sidebar from "@/components/Layout/Sidebar";
import Navbar from "@/components/Layout/Navbar";
import PrintPanel from "@/components/PrintPanel";
import { useState } from "react";

export default function Print() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={setSidebarCollapsed}
      />
      <Navbar
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        sidebarCollapsed={sidebarCollapsed}
      />

      <main
        className={`pt-16 transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-80"
        }`}
      >
        <PrintPanel />
      </main>
    </div>
  );
}
