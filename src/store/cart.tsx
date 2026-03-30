"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartLineItem {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  priceAgorot: number;
  quantity: number;
  imageColor?: string;  // css color for placeholder
  productIcon?: string; // emoji for display
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

const STORAGE_KEY = "meshek22_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isOpen: false,
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const items = JSON.parse(raw) as CartLineItem[];
        dispatch({ type: "HYDRATE", items });
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // ignore
    }
  }, [state.items]);

  const addItem = useCallback(
    (item: Omit<CartLineItem, "quantity"> & { quantity?: number }) => {
      dispatch({ type: "ADD", payload: item });
    },
    []
  );

  const removeItem = useCallback((variantId: string) => {
    dispatch({ type: "REMOVE", variantId });
  }, []);

  const updateQty = useCallback((variantId: string, quantity: number) => {
    dispatch({ type: "UPDATE_QTY", variantId, quantity });
  }, []);

  const clearCart = useCallback(() => dispatch({ type: "CLEAR" }), []);
  const openCart = useCallback(() => dispatch({ type: "OPEN" }), []);
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
