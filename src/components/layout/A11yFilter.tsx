"use client";

/**
 * A11yFilter wraps the page content tree and conditionally applies
 * CSS filter for high-contrast mode.
 *
 * It MUST wrap only {children}, NOT the fixed-position overlays
 * (CartDrawer, AccessibilityWidget, modals). Applying filter to an ancestor
 * of position:fixed elements causes them to be positioned relative to the
 * filtered element instead of the viewport — making them jump on scrolled pages.
 * By filtering only this content wrapper, the overlays remain unaffected.
 */

import type { ReactNode } from "react";
import { useAccessibility } from "@/store/accessibility";

export function A11yFilter({ children }: { children: ReactNode }) {
  const { settings } = useAccessibility();

  return (
    <div
      style={
        settings.highContrast
          ? { filter: "contrast(1.25) saturate(0.9)" }
          : undefined
      }
    >
      {children}
    </div>
  );
}
