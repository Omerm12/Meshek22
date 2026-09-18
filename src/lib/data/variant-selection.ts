/**
 * Which variant a product should open on.
 *
 * Its own module so the rule has exactly one implementation — storefront.ts's
 * row→product mapping is the only caller today, but the point of pulling this
 * out is that nothing else can grow a second, slightly different copy.
 */
import type { MockVariant } from "@/lib/data/mock";

/**
 * The kilogram unit value from the admin's VariantUnit enum
 * (@/lib/validations/admin-product). Duplicated as a literal rather than
 * imported: that module pulls in zod schemas that have no reason to be part
 * of the public storefront bundle.
 */
const KILOGRAM_UNIT = "1kg";

/**
 * Structured-field check for "this variant is priced by the kilogram" —
 * never a comparison against the Hebrew display label ('1 ק"ג'), which an
 * admin can freely edit or retranslate without it ceasing to be a kilogram
 * variant.
 */
export function isKilogramVariant(variant: Pick<MockVariant, "unit">): boolean {
  return variant.unit === KILOGRAM_UNIT;
}

/**
 * The variant a product should be shown with selected the moment it renders.
 *
 * A product that offers a kilogram option opens on it unconditionally —
 * that's what a customer weighing loose produce expects — regardless of which
 * variant an admin happened to flag `isDefault` for merchandising purposes
 * (sale badges, catalogue sort order, etc.). Without an active kilogram
 * variant, the rule is exactly what it was before this existed: the admin's
 * chosen default, or simply the first available variant.
 *
 * `variants` must already be filtered to active/available ones — this
 * function does not check availability itself, so an inactive kilogram
 * variant that was never filtered out would incorrectly win.
 */
export function pickInitialVariant<T extends Pick<MockVariant, "unit" | "isDefault">>(
  variants: readonly T[]
): T | undefined {
  return variants.find(isKilogramVariant) ?? variants.find((v) => v.isDefault) ?? variants[0];
}
