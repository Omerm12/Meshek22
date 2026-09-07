import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

/**
 * CardBrandNotice is a plain, state-free function component, so it can be
 * invoked directly (no jsdom/testing-library in this project — see
 * vitest.config.ts, environment "node") and its returned React element tree
 * inspected as plain objects.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectText(node: any, out: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element?.props?.children !== undefined) collectText(element.props.children, out);
  return out;
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/payment/cardcom-brands");
});

describe("CardBrandNotice", () => {
  it("renders the exact generic Hebrew notice when no brand is confirmed", async () => {
    const { CardBrandNotice } = await import("@/components/checkout/CardBrandNotice");
    const { GENERIC_CARD_NOTICE } = await import("@/lib/payment/cardcom-brands");

    const element = CardBrandNotice();
    const text = collectText(element).join("");

    expect(text).toContain(GENERIC_CARD_NOTICE);
    // role="note" so a screen reader announces it without an extra click.
    expect((element as ReactElement<{ role?: string }>).props.role).toBe("note");
  });

  it("renders only conclusively-verified brands, with an accessible label each, once configured", async () => {
    vi.doMock("@/lib/payment/cardcom-brands", () => ({
      CONFIRMED_CARD_BRANDS: [{ id: "visa", label: "ויזה" }, { id: "mastercard", label: "מאסטרקארד" }],
      GENERIC_CARD_NOTICE: "GENERIC_NOTICE_SHOULD_NOT_APPEAR",
    }));
    vi.resetModules();

    const { CardBrandNotice } = await import("@/components/checkout/CardBrandNotice");
    const element = CardBrandNotice();
    const text = collectText(element).join(" ");

    expect(text).toContain("ויזה");
    expect(text).toContain("מאסטרקארד");
    expect(text).not.toContain("GENERIC_NOTICE_SHOULD_NOT_APPEAR");
  });
});
