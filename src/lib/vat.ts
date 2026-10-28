/**
 * Product VAT classification.
 *
 * Prices in Meshek22 are VAT-inclusive and the charged amount never changes with
 * the class — the class only tells CardCom how to account for each document line
 * (`Document.Products[].IsVatFree`). It is stored on `products.vat_class` and
 * copied into `order_items.product_snapshot.vat_class` when an order is created,
 * so later product edits never rewrite an existing order's tax treatment.
 */

export const VAT_CLASSES = ["standard", "zero_rated"] as const;
export type VatClass = (typeof VAT_CLASSES)[number];

export const VAT_CLASS_LABELS: Record<VatClass, string> = {
  standard:   "מע״מ רגיל",
  zero_rated: "פטור ממע״מ (0%)",
};

export function isVatClass(value: unknown): value is VatClass {
  return typeof value === "string" && (VAT_CLASSES as readonly string[]).includes(value);
}

/**
 * Delivery fee VAT. TEMPORARY ASSUMPTION: standard VAT, pending the
 * accountant's confirmation. Change this one constant if that is revised.
 */
export const DELIVERY_VAT_CLASS: VatClass = "standard";

export interface ResolvedVat {
  vatClass: VatClass;
  /**
   * True when the order item carries no valid VAT snapshot (an order created
   * before VAT classification existed, or corrupt data). The true treatment is
   * then unknown: callers must NOT issue a tax document from it (payment retry
   * refuses) and must flag the order for review. `vatClass` is only a neutral
   * placeholder. A product's CURRENT class is never used: it may have changed
   * since the order was placed.
   */
  legacy: boolean;
}

/** Reads the class an order item was sold under from its stored product_snapshot. */
export function resolveSnapshotVat(productSnapshot: unknown): ResolvedVat {
  const raw =
    productSnapshot && typeof productSnapshot === "object"
      ? (productSnapshot as Record<string, unknown>).vat_class
      : undefined;
  return isVatClass(raw)
    ? { vatClass: raw, legacy: false }
    : { vatClass: "standard", legacy: true };
}
