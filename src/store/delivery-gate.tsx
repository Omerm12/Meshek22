"use client";

/**
 * Delivery Gate store.
 *
 * Intercepts the first add-to-cart attempt for logged-out visitors and holds
 * the pending item until the user confirms their delivery settlement.
 *
 * Rules:
 *   - Only activates when the user is NOT logged in (caller's responsibility).
 *   - Only activates when delivery has not yet been confirmed.
 *   - Once confirmed, the flag is persisted in localStorage so subsequent
 *     add-to-cart actions in the same browser session bypass the gate.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import type { CartLineItem } from "@/store/cart";

// sessionStorage: resets when the browser tab/session ends, so the modal
// reappears on every new visit while not repeating during the same session.
const STORAGE_KEY = "meshek22_delivery_confirmed";
// Tracks whether the modal was already shown this session (even if dismissed).
const SHOWN_KEY   = "meshek22_delivery_shown";

export type PendingCartItem = Omit<CartLineItem, "quantity"> & { quantity?: number };

interface DeliveryGateContextValue {
  isOpen: boolean;
  isConfirmed: boolean;
  pendingItem: PendingCartItem | null;
  /**
   * Attempt to add an item. If the gate needs to show, opens the modal and
   * returns true (caller must NOT call addItem — modal handles it).
   * If the gate has already been confirmed, returns false (caller should
   * proceed with addItem immediately).
   */
  requestAdd: (item: PendingCartItem) => boolean;
  closeGate: () => void;
  /**
   * Called when delivery is confirmed: persists the flag, adds the pending
   * item via the supplied addItem function, and closes the modal.
   */
  confirmAndAdd: (addItemFn: (item: PendingCartItem) => void) => void;
}

const DeliveryGateContext = createContext<DeliveryGateContextValue>({
  isOpen: false,
  isConfirmed: false,
  pendingItem: null,
  requestAdd: () => false,
  closeGate: () => {},
  confirmAndAdd: () => {},
});

export function DeliveryGateProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen]           = useState(false);
  // Lazy initializer: read sessionStorage once on mount (SSR-safe via try/catch).
  // sessionStorage resets when the browser session ends, so the gate reappears
  // on every new visit while staying suppressed during the same session.
  const [isConfirmed, setIsConfirmed] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });
  const [pendingItem, setPendingItem] = useState<PendingCartItem | null>(null);
  // Ref mirrors pendingItem for stable closure access inside callbacks
  const pendingRef = useRef<PendingCartItem | null>(null);

  const requestAdd = useCallback((item: PendingCartItem): boolean => {
    let confirmed    = isConfirmed;
    let alreadyShown = false;
    try {
      confirmed    = confirmed || sessionStorage.getItem(STORAGE_KEY) === "true";
      alreadyShown = sessionStorage.getItem(SHOWN_KEY) === "true";
    } catch {}

    if (confirmed)    return false; // Already confirmed — proceed with direct add
    if (alreadyShown) return false; // Dismissed this session — do not reopen

    // Mark as shown and open the modal
    try { sessionStorage.setItem(SHOWN_KEY, "true"); } catch {}
    pendingRef.current = item;
    setPendingItem(item);
    setIsOpen(true);
    return true;
  }, [isConfirmed]);

  const closeGate = useCallback(() => {
    setIsOpen(false);
    pendingRef.current = null;
    setPendingItem(null);
  }, []);

  const confirmAndAdd = useCallback(
    (addItemFn: (item: PendingCartItem) => void) => {
      // Mark confirmed and persist to sessionStorage
      setIsConfirmed(true);
      try { sessionStorage.setItem(STORAGE_KEY, "true"); } catch {}

      // Add the waiting item
      const item = pendingRef.current;
      if (item) addItemFn(item);

      // Close modal and clear pending state
      setIsOpen(false);
      pendingRef.current = null;
      setPendingItem(null);
    },
    []
  );

  const value = useMemo<DeliveryGateContextValue>(
    () => ({ isOpen, isConfirmed, pendingItem, requestAdd, closeGate, confirmAndAdd }),
    [isOpen, isConfirmed, pendingItem, requestAdd, closeGate, confirmAndAdd]
  );

  return (
    <DeliveryGateContext.Provider value={value}>
      {children}
    </DeliveryGateContext.Provider>
  );
}

export function useDeliveryGate() {
  return useContext(DeliveryGateContext);
}
