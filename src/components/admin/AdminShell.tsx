"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";

interface AdminShellProps {
  adminName: string | null;
  adminEmail: string | null;
  children: React.ReactNode;
}

export function AdminShell({ adminName, adminEmail, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-100 print:bg-white" dir="rtl" data-admin-shell>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar and header are chrome, not content — hidden for any page
          that prints (e.g. the order picking sheet), so only that page's own
          print-only markup ends up on paper.

          `data-admin-chrome` backs the `print:hidden` utility with an explicit,
          `!important` rule in globals.css: AdminSidebar's own `fixed`/
          `translate-x-full` positioning only turns off above the `lg`
          breakpoint, and a print viewport is narrower than that, so this
          cannot depend on which Tailwind utility happens to win the cascade —
          it must always be display:none at print time regardless. */}
      <div className="print:hidden contents" data-admin-chrome>
        <AdminSidebar
          adminName={adminName}
          adminEmail={adminEmail}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 shrink-0 gap-3 print:hidden"
          data-admin-chrome
        >
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden h-9 w-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="פתח תפריט"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <p className="text-sm text-gray-500">
            מחובר כ-
            <span className="font-semibold text-gray-900 ms-1">
              {adminName ?? adminEmail}
            </span>
          </p>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto" data-admin-main>
          {children}
        </main>
      </div>
    </div>
  );
}
