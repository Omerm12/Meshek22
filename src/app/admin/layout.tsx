import { requireAdmin } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";

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
  const admin = await requireAdmin();

  return (
    <AdminShell adminName={admin.full_name} adminEmail={admin.email}>
      {children}
    </AdminShell>
  );
}
