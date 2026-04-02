import { requireAdmin } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata = {
  title: {
    default: "ניהול | משק 22",
    template: "%s | ניהול משק 22",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireAdmin() verifies session + role on every request.
  // If the user is not authenticated or not an admin it redirects before
  // rendering any children — no page content is ever sent to non-admins.
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen bg-gray-100" dir="rtl">
      <AdminSidebar adminName={admin.full_name} adminEmail={admin.email} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 shrink-0">
          <p className="text-sm text-gray-500">
            מחובר כ-
            <span className="font-semibold text-gray-900 ms-1">
              {admin.full_name ?? admin.email}
            </span>
          </p>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
