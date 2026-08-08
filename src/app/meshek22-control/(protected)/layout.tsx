import { requireAdmin } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Protected administrator layout.
 *
 * requireAdmin() runs here for every page in the group. It is memoised with
 * React cache() for the duration of the request, so the pages beneath no longer
 * repeat the Auth + profile round-trip — that duplicate was the single largest
 * source of admin page latency.
 *
 * Pages inside this group therefore do not call requireAdmin() again. Server
 * Actions still do, because an action can be invoked directly by HTTP without
 * this layout ever rendering.
 */
export default async function ProtectedAdminLayout({
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
