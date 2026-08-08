"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/store/cart";

/**
 * Empties the guest cart once an order is definitively accepted.
 *
 * Rendered ONLY by the success page, and only after it has confirmed with a
 * valid access token that the order exists and is either paid online or accepted
 * offline. That timing matters: a failed or cancelled CardCom payment never
 * reaches this component, so the customer's basket survives and they can retry
 * without rebuilding it.
 *
 * The checkout draft in sessionStorage is dropped at the same time so a later
 * visit to /checkout starts clean.
 */
export function ClearCartOnMount() {
  const { clearCart, isHydrated } = useCart();
  const clearedRef = useRef(false);

  useEffect(() => {
    // Wait for localStorage hydration, otherwise the clear can be overwritten by
    // the restore that runs immediately afterwards.
    if (!isHydrated || clearedRef.current) return;
    clearedRef.current = true;
    clearCart();
    try {
      sessionStorage.removeItem("meshek22_checkout_draft");
    } catch {}
  }, [isHydrated, clearCart]);

  return null;
}
