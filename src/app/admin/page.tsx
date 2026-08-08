import { notFound } from "next/navigation";

/**
 * The administrator portal used to live here. It has moved, and /admin must no
 * longer hint that a portal exists at all — so this returns a plain 404 rather
 * than redirecting somewhere revealing.
 *
 * The path change is an obscurity layer only. Real protection is server-side:
 * requireAdmin() on the protected layout, an independent check inside every
 * mutation Server Action, RLS on the tables, and service-role-only RPCs.
 */
export default function RemovedAdminPage(): never {
  notFound();
}
