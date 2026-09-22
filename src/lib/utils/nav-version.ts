import type { NavCategoryNode } from "@/lib/data/storefront";

/**
 * A compact fingerprint of the navbar's category tree — its composition,
 * order and names, top level and one level of children deep. Two trees
 * produce the same version if and only if they'd render identically.
 *
 * Type-only import from storefront.ts (no runtime import): this file must
 * stay safe to import from a Client Component (Header.tsx), so it cannot
 * pull in storefront.ts's Supabase/unstable_cache module graph.
 */
export function computeNavbarVersion(tree: NavCategoryNode[]): string {
  return tree
    .map(
      (node) =>
        `${node.id}:${node.name}:${node.children
          .map((child) => `${child.id}:${child.name}`)
          .join(",")}`
    )
    .join("|");
}
