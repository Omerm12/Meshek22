/**
 * Guest cart persistence.
 *
 * The cart belongs to the browser, not to an account, so it lives in
 * localStorage under a versioned envelope. Anything that is not exactly the
 * current version is discarded rather than guessed at, and every individual
 * entry is validated on read — hand-edited, truncated or stale storage can never
 * crash the storefront, it just yields a smaller (or empty) cart.
 *
 * Deliberately free of React and of any browser-only import at module scope, so
 * it can be unit-tested directly.
 */

export interface StoredCartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  priceAgorot: number;
  quantity: number;
  imageUrl?: string | null;
  imageColor?: string;
  productIcon?: string;
  quantityPricingMode: "per_kg" | "fixed";
  quantityStep: number;
  minQuantity: number;
  dealEnabled?: boolean;
  dealQuantity?: number | null;
  dealPriceAgorot?: number | null;
}

export const CART_STORAGE_KEY = "meshek22_cart";
export const CART_VERSION = 1;

/** Upper bound on restored lines, so a corrupted file cannot exhaust memory. */
const MAX_ITEMS = 200;
const MAX_QUANTITY = 999;

interface StoredCartEnvelope {
  version: number;
  items: unknown;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Validate one persisted entry. Anything malformed returns null and is dropped.
 * Prices are never trusted from here for charging — the server re-reads them at
 * checkout — but they must still be structurally sane to render.
 */
export function parseStoredCartItem(raw: unknown): StoredCartItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;

  if (typeof item.variantId !== "string" || item.variantId.length === 0) return null;
  if (typeof item.productId !== "string") return null;
  if (typeof item.productName !== "string") return null;
  if (typeof item.variantLabel !== "string") return null;
  if (typeof item.priceAgorot !== "number" || !Number.isFinite(item.priceAgorot)) return null;
  if (item.priceAgorot < 0) return null;
  if (!isPositiveFinite(item.quantity) || item.quantity > MAX_QUANTITY) return null;

  return {
    variantId:           item.variantId,
    productId:           item.productId,
    productName:         item.productName,
    variantLabel:        item.variantLabel,
    priceAgorot:         item.priceAgorot,
    quantity:            item.quantity,
    imageUrl:            typeof item.imageUrl    === "string" ? item.imageUrl    : null,
    imageColor:          typeof item.imageColor  === "string" ? item.imageColor  : undefined,
    productIcon:         typeof item.productIcon === "string" ? item.productIcon : undefined,
    quantityPricingMode: item.quantityPricingMode === "per_kg" ? "per_kg" : "fixed",
    quantityStep:        isPositiveFinite(item.quantityStep) ? item.quantityStep : 1,
    minQuantity:         isPositiveFinite(item.minQuantity)  ? item.minQuantity  : 1,
    dealEnabled:         item.dealEnabled === true,
    dealQuantity:        isPositiveFinite(item.dealQuantity) ? item.dealQuantity : null,
    dealPriceAgorot:
      typeof item.dealPriceAgorot === "number" && Number.isFinite(item.dealPriceAgorot)
        ? item.dealPriceAgorot
        : null,
  };
}

/** Decode a raw localStorage string into a usable cart. Never throws. */
export function deserializeCart(raw: string | null): StoredCartItem[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (typeof parsed !== "object" || parsed === null) return [];

  const envelope = parsed as StoredCartEnvelope;
  // An older (or newer) format is discarded rather than migrated blindly.
  if (envelope.version !== CART_VERSION) return [];
  if (!Array.isArray(envelope.items)) return [];

  return envelope.items
    .map(parseStoredCartItem)
    .filter((i): i is StoredCartItem => i !== null)
    .slice(0, MAX_ITEMS);
}

/** Encode a cart for localStorage. */
export function serializeCart(items: StoredCartItem[]): string {
  return JSON.stringify({ version: CART_VERSION, items } satisfies StoredCartEnvelope);
}

/** Read the cart from localStorage, tolerating disabled or full storage. */
export function readStoredCart(): StoredCartItem[] {
  try {
    return deserializeCart(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Persist the cart, tolerating disabled or full storage. */
export function writeStoredCart(items: StoredCartItem[]): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(items));
  } catch {
    // Private mode, quota exceeded, or storage disabled — the cart still works
    // for this page view; it just will not survive a refresh.
  }
}
