/**
 * Single source of truth for administrator URLs.
 *
 * The portal lives at an unguessable-looking path rather than /admin. That is
 * obscurity, NOT security — this repository is public, so the path is public
 * too. Every real control is enforced server-side: requireAdmin() guards the
 * protected layout, each mutation Server Action re-checks authorisation
 * independently, and RLS plus service-role-only RPCs guard the database.
 *
 * Import from here instead of writing the path inline, so the portal can be
 * relocated again by editing one constant.
 */

export const ADMIN_BASE_PATH = "/meshek22-control";

export const ADMIN_ROUTES = {
  dashboard:     ADMIN_BASE_PATH,
  login:         `${ADMIN_BASE_PATH}/login`,
  orders:        `${ADMIN_BASE_PATH}/orders`,
  products:      `${ADMIN_BASE_PATH}/products`,
  categories:    `${ADMIN_BASE_PATH}/categories`,
  promotions:    `${ADMIN_BASE_PATH}/promotions`,
  deliveryZones: `${ADMIN_BASE_PATH}/delivery-zones`,
  settlements:   `${ADMIN_BASE_PATH}/settlements`,
} as const;

/** Build a path under the admin portal, e.g. adminPath("/orders", "abc"). */
export function adminPath(...segments: string[]): string {
  const suffix = segments
    .map((s) => s.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return suffix ? `${ADMIN_BASE_PATH}/${suffix}` : ADMIN_BASE_PATH;
}
