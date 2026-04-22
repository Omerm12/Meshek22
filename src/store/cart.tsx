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
import { useUser } from "@/store/user";
import {
  dbLoadCart,
  dbUpsertCartItem,
  dbRemoveCartItem,
  dbClearCart,
} from "@/app/actions/cart";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartLineItem {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  priceAgorot: number;
  quantity: number;
  imageUrl?: string | null;
  imageColor?: string;
  productIcon?: string;
  /** 'per_kg': line total = priceAgorot × quantity. 'fixed': line total = priceAgorot. */
  quantityPricingMode: "per_kg" | "fixed";
  /** Increment/decrement step for +/− buttons (e.g. 0.5 for 500g steps). */
  quantityStep: number;
  /** Minimum allowed quantity; first add initialises the cart item to this value. */
  minQuantity: number;
  /** Bundle deal: buy dealQuantity units for dealPriceAgorot total */
  dealEnabled?: boolean;
  dealQuantity?: number | null;
  dealPriceAgorot?: number | null;
}

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
  subtotalAgorot: number;
  /** True once the auth-aware hydration step has completed. */
  isHydrated: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round a quantity to the precision implied by the step size. */
function roundToStep(value: number, step: number): number {
  const decimals = (step.toString().split(".")[1] ?? "").length;
  return parseFloat(value.toFixed(decimals));
}

/**
 * Compute the line total for a cart item in agorot, applying bundle deal pricing
 * when the deal is active and the quantity meets the threshold.
 *
 * Deal formula: complete groups × dealPrice + remainder × unitPrice
 */
export function calculateLineTotal(item: CartLineItem): number {
  if (
    item.dealEnabled &&
    item.dealQuantity != null &&
    item.dealPriceAgorot != null &&
    item.quantity >= item.dealQuantity
  ) {
    const groups    = Math.floor(item.quantity / item.dealQuantity);
    const remainder = item.quantity % item.dealQuantity;
    return groups * item.dealPriceAgorot + Math.round(remainder * item.priceAgorot);
  }
  return Math.round(item.priceAgorot * item.quantity);
}

/** Default values for the new fields — applied when payload omits them. */
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
  const { user, isLoading: authLoading } = useUser();
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isOpen: false,
  });
  const [isHydrated, setIsHydrated] = useState(false);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // ── Auth-aware DB hydration ───────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;

    const prevId = prevUserIdRef.current;
    const currId = user?.id ?? null;

    if (prevId === undefined) {
      prevUserIdRef.current = currId;
      if (currId) {
        dbLoadCart()
          .then((items) => {
            dispatch({ type: "HYDRATE", items });
            setIsHydrated(true);
          })
          .catch(() => setIsHydrated(true));
      } else {
        queueMicrotask(() => setIsHydrated(true));
      }
      return;
    }

    if (prevId === currId) return;
    prevUserIdRef.current = currId;

    if (currId && !prevId) {
      const guestItems = stateRef.current.items;
      dbLoadCart()
        .then((dbItems) => {
          if (guestItems.length === 0) {
            dispatch({ type: "HYDRATE", items: dbItems });
            return;
          }
          const dbVariantIds  = new Set(dbItems.map((i) => i.variantId));
          const guestOnlyItems = guestItems.filter((i) => !dbVariantIds.has(i.variantId));
          const merged = [...dbItems, ...guestOnlyItems];
          dispatch({ type: "HYDRATE", items: merged });
          for (const item of guestOnlyItems) {
            dbUpsertCartItem(item).catch(() => {});
          }
        })
        .catch(() => {});
    } else if (!currId && prevId) {
      dispatch({ type: "CLEAR" });
    }
  }, [authLoading, user?.id]);

  // ── Mutation callbacks ────────────────────────────────────────────────────

  const addItem = useCallback((item: AddItemPayload) => {
    dispatch({ type: "ADD", payload: item });
    if (!userRef.current) return;
    const pricingMode = item.quantityPricingMode ?? DEFAULT_PRICING_MODE;
    const step        = item.quantityStep ?? DEFAULT_STEP;
    const minQty      = item.minQuantity  ?? DEFAULT_MIN;
    const rawQty      = item.quantity ?? minQty;
    const existing    = stateRef.current.items.find((i) => i.variantId === item.variantId);
    const finalQty    = roundToStep(
      Math.min((existing?.quantity ?? 0) + rawQty, 999),
      step
    );
    dbUpsertCartItem({
      ...item,
      quantity:            finalQty,
      quantityPricingMode: pricingMode,
      quantityStep:        step,
      minQuantity:         minQty,
    }).catch(() => {});
  }, []);

  const removeItem = useCallback((variantId: string) => {
    dispatch({ type: "REMOVE", variantId });
    if (!userRef.current) return;
    dbRemoveCartItem(variantId).catch(() => {});
  }, []);

  const updateQty = useCallback((variantId: string, quantity: number) => {
    dispatch({ type: "UPDATE_QTY", variantId, quantity });
    if (!userRef.current) return;
    if (quantity <= 0) {
      dbRemoveCartItem(variantId).catch(() => {});
    } else {
      const item = stateRef.current.items.find((i) => i.variantId === variantId);
      if (item) {
        const clamped = roundToStep(Math.min(quantity, 999), item.quantityStep ?? 1);
        dbUpsertCartItem({ ...item, quantity: clamped }).catch(() => {});
      }
    }
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR" });
    if (!userRef.current) return;
    dbClearCart().catch(() => {});
  }, []);

  const openCart  = useCallback(() => dispatch({ type: "OPEN" }),  []);
  const closeCart = useCallback(() => dispatch({ type: "CLOSE" }), []);

  // Number of distinct products in the cart (integer — safe for the nav badge).
  const totalItems = useMemo(() => state.items.length, [state.items]);

  const subtotalAgorot = useMemo(
    () => state.items.reduce((s, i) => s + calculateLineTotal(i), 0),
    [state.items]
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
        subtotalAgorot,
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
