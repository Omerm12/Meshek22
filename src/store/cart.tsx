"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { calculateCartPricing } from "@/lib/promotions/engine";
import type { CartPricing, PricedItem, Promotion } from "@/lib/promotions/types";
import { readStoredCart, writeStoredCart, type StoredCartItem } from "@/lib/cart/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A line in the guest cart. Identical to the persisted shape — the cart is
 * saved to localStorage verbatim and validated field by field on the way back
 * in (see @/lib/cart/storage).
 */
export type CartLineItem = StoredCartItem;

// Payload for addItem — new fields are optional for backward-compat callers.
export type AddItemPayload = Omit<
  CartLineItem,
  "quantity" | "quantityPricingMode" | "quantityStep" | "minQuantity"
> & {
  quantity?: number;
  quantityPricingMode?: "per_kg" | "fixed";
  quantityStep?: number;
  minQuantity?: number;
};

interface CartState {
  items: CartLineItem[];
  isOpen: boolean;
}

type CartAction =
  | { type: "ADD"; payload: AddItemPayload }
  | { type: "REMOVE"; variantId: string }
  | { type: "UPDATE_QTY"; variantId: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "HYDRATE"; items: CartLineItem[] };

interface CartContextValue extends CartState {
  addItem: (item: AddItemPayload) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  /** Number of distinct line items in the cart (used for the nav badge). */
  totalItems: number;
  /** Undiscounted total of every line — matches orders.subtotal_agorot. */
  subtotalAgorot: number;
  /** Full promotion breakdown for this cart. Display only; the server recomputes. */
  pricing: CartPricing;
  /** Live group promotions, refreshed from the server on mount. */
  promotions: Promotion[];
  /** True once localStorage has been read. */
  isHydrated: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round a quantity to the precision implied by the step size. */
function roundToStep(value: number, step: number): number {
  const decimals = (step.toString().split(".")[1] ?? "").length;
  return parseFloat(value.toFixed(decimals));
}

/** Convert a cart line into the shape the pricing engine expects. */
export function toPricedItem(item: CartLineItem): PricedItem {
  return {
    variantId:           item.variantId,
    productId:           item.productId,
    quantity:            item.quantity,
    priceAgorot:         item.priceAgorot,
    quantityPricingMode: item.quantityPricingMode,
    dealEnabled:         item.dealEnabled,
    dealQuantity:        item.dealQuantity,
    dealPriceAgorot:     item.dealPriceAgorot,
  };
}

/**
 * Undiscounted total for a single line, in agorot.
 * Kept for callers that only need the "before promotion" figure.
 */
export function calculateLineTotal(item: CartLineItem): number {
  return Math.round(item.priceAgorot * item.quantity);
}

const DEFAULT_PRICING_MODE = "fixed" as const;
const DEFAULT_STEP = 1;
const DEFAULT_MIN = 1;

// ─── Reducer ─────────────────────────────────────────────────────────────────

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, items: action.items };

    case "ADD": {
      const pricingMode = action.payload.quantityPricingMode ?? DEFAULT_PRICING_MODE;
      const step        = action.payload.quantityStep ?? DEFAULT_STEP;
      const minQty      = action.payload.minQuantity  ?? DEFAULT_MIN;
      // Use provided quantity, else initialise to minQuantity (important for per_kg)
      const rawQty      = action.payload.quantity ?? minQty;
      const qty         = roundToStep(Math.min(rawQty, 999), step);

      const existing = state.items.find((i) => i.variantId === action.payload.variantId);
      if (existing) {
        const newQty = roundToStep(Math.min(existing.quantity + qty, 999), step);
        return {
          ...state,
          items: state.items.map((i) =>
            i.variantId === action.payload.variantId
              ? { ...i, quantity: newQty }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            ...action.payload,
            quantity:            qty,
            quantityPricingMode: pricingMode,
            quantityStep:        step,
            minQuantity:         minQty,
          },
        ],
      };
    }

    case "REMOVE":
      return {
        ...state,
        items: state.items.filter((i) => i.variantId !== action.variantId),
      };

    case "UPDATE_QTY": {
      if (action.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter((i) => i.variantId !== action.variantId),
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.variantId === action.variantId
            ? {
                ...i,
                quantity: roundToStep(Math.min(action.quantity, 999), i.quantityStep ?? 1),
              }
            : i
        ),
      };
    }

    case "CLEAR":
      return { ...state, items: [] };

    case "OPEN":
      return { ...state, isOpen: true };

    case "CLOSE":
      return { ...state, isOpen: false };

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false });
  const [isHydrated, setIsHydrated] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  // Skip the very first persist pass so an empty initial state never overwrites
  // a stored cart before hydration has run.
  const hydratedRef = useRef(false);

  // ── Restore from localStorage (once, on mount) ────────────────────────────
  //
  // The isHydrated flag is deferred to a microtask so it lands in the same paint
  // as the restored items rather than triggering a second synchronous render.
  useEffect(() => {
    const items = readStoredCart();
    if (items.length > 0) dispatch({ type: "HYDRATE", items });
    hydratedRef.current = true;
    queueMicrotask(() => setIsHydrated(true));
  }, []);

  // ── Persist on every change ───────────────────────────────────────────────
  useEffect(() => {
    if (!hydratedRef.current) return;
    writeStoredCart(state.items);
  }, [state.items]);

  // ── Load live promotions ──────────────────────────────────────────────────
  //
  // Cosmetic only: it makes the cart show the same saving the server will apply.
  // Checkout ignores anything sent from the browser and recalculates from the
  // database, so a stale or tampered response here cannot change what is charged.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/promotions/active")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Promotion[]) => {
        if (!cancelled && Array.isArray(data)) setPromotions(data);
      })
      .catch(() => {
        // Offline or blocked — fall back to undiscounted display.
      });
    return () => { cancelled = true; };
  }, []);

  // ── Mutation callbacks ────────────────────────────────────────────────────

  const addItem    = useCallback((item: AddItemPayload) => dispatch({ type: "ADD", payload: item }), []);
  const removeItem = useCallback((variantId: string) => dispatch({ type: "REMOVE", variantId }), []);
  const updateQty  = useCallback(
    (variantId: string, quantity: number) => dispatch({ type: "UPDATE_QTY", variantId, quantity }),
    []
  );
  const clearCart  = useCallback(() => dispatch({ type: "CLEAR" }), []);
  const openCart   = useCallback(() => dispatch({ type: "OPEN" }),  []);
  const closeCart  = useCallback(() => dispatch({ type: "CLOSE" }), []);

  // Number of distinct products in the cart (integer — safe for the nav badge).
  const totalItems = useMemo(() => state.items.length, [state.items]);

  const pricing = useMemo(
    () => calculateCartPricing(state.items.map(toPricedItem), promotions),
    [state.items, promotions]
  );

  return (
    <CartContext.Provider
      value={{
        ...state,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        openCart,
        closeCart,
        totalItems,
        subtotalAgorot: pricing.subtotalAgorot,
        pricing,
        promotions,
        isHydrated,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
