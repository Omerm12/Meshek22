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
}

interface CartState {
  items: CartLineItem[];
  isOpen: boolean;
}

type CartAction =
  | { type: "ADD"; payload: Omit<CartLineItem, "quantity"> & { quantity?: number } }
  | { type: "REMOVE"; variantId: string }
  | { type: "UPDATE_QTY"; variantId: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "HYDRATE"; items: CartLineItem[] };

interface CartContextValue extends CartState {
  addItem: (item: Omit<CartLineItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalItems: number;
  subtotalAgorot: number;
  /** True once the auth-aware hydration step has completed. */
  isHydrated: boolean;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, items: action.items };

    case "ADD": {
      const qty = action.payload.quantity ?? 1;
      const existing = state.items.find(
        (i) => i.variantId === action.payload.variantId
      );
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.variantId === action.payload.variantId
              ? { ...i, quantity: Math.min(i.quantity + qty, 99) }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          { ...action.payload, quantity: Math.min(qty, 99) },
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
            ? { ...i, quantity: Math.min(action.quantity, 99) }
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
  // True once the auth-aware hydration step has completed (guards against empty-
  // cart flicker before we've loaded from DB).
  const [isHydrated, setIsHydrated] = useState(false);

  // Stable refs so callbacks don't need to re-create when state/user changes.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // undefined = auth has not resolved yet (distinguishes "loading" from "guest").
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // ── Auth-aware DB hydration ───────────────────────────────────────────────
  //
  // Rules:
  //   Initial resolution (authenticated) → load cart from DB
  //   Initial resolution (guest)         → mark hydrated with empty cart
  //   Login transition (null → id)       → load cart from DB
  //   Logout transition (id → null)      → clear in-memory cart; DB cart stays
  //                                        intact for next login
  useEffect(() => {
    if (authLoading) return;

    const prevId = prevUserIdRef.current;
    const currId = user?.id ?? null;

    if (prevId === undefined) {
      // First resolution after mount
      prevUserIdRef.current = currId;
      if (currId) {
        dbLoadCart()
          .then((items) => {
            dispatch({ type: "HYDRATE", items });
            setIsHydrated(true);
          })
          .catch(() => setIsHydrated(true));
      } else {
        // Guest: empty cart, no DB load
        setIsHydrated(true);
      }
      return;
    }

    if (prevId === currId) return;
    prevUserIdRef.current = currId;

    if (currId && !prevId) {
      // Logged in: merge guest items into DB cart.
      // Guest items were never synced (addItem skips DB for guests), so we must
      // write them to the DB now. DB items win on variant conflict (same variantId).
      const guestItems = stateRef.current.items;
      dbLoadCart()
        .then((dbItems) => {
          if (guestItems.length === 0) {
            // No guest items — just restore DB cart as-is
            dispatch({ type: "HYDRATE", items: dbItems });
            return;
          }
          // Merge: keep all DB items, append guest-only items (not already in DB)
          const dbVariantIds = new Set(dbItems.map((i) => i.variantId));
          const guestOnlyItems = guestItems.filter((i) => !dbVariantIds.has(i.variantId));
          const merged = [...dbItems, ...guestOnlyItems];
          dispatch({ type: "HYDRATE", items: merged });
          // Persist guest-only items to DB so they survive a page refresh
          for (const item of guestOnlyItems) {
            dbUpsertCartItem(item).catch(() => {});
          }
        })
        .catch(() => {});
    } else if (!currId && prevId) {
      // Logged out: clear in-memory cart (no DB touch — their cart persists for next login)
      dispatch({ type: "CLEAR" });
    }
  }, [authLoading, user?.id]);

  // ── Mutation callbacks (optimistic + background DB sync) ─────────────────
  //
  // All mutations update in-memory state synchronously (instant UI feedback),
  // then fire a Server Action in the background. The Server Action is
  // fire-and-forget — UI is always consistent via in-memory state.
  // Stable callbacks via refs: no dependency on state or user directly.

  const addItem = useCallback(
    (item: Omit<CartLineItem, "quantity"> & { quantity?: number }) => {
      dispatch({ type: "ADD", payload: item });
      if (!userRef.current) return;
      // Compute final quantity matching reducer logic
      const existing = stateRef.current.items.find(
        (i) => i.variantId === item.variantId
      );
      const finalQty = Math.min(
        (existing?.quantity ?? 0) + (item.quantity ?? 1),
        99
      );
      dbUpsertCartItem({ ...item, quantity: finalQty }).catch(() => {});
    },
    []
  );

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
        dbUpsertCartItem({ ...item, quantity: Math.min(quantity, 99) }).catch(() => {});
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

  const totalItems = useMemo(
    () => state.items.reduce((s, i) => s + i.quantity, 0),
    [state.items]
  );

  const subtotalAgorot = useMemo(
    () => state.items.reduce((s, i) => s + i.priceAgorot * i.quantity, 0),
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
