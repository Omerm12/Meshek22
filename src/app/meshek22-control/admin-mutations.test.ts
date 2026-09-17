import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Cross-cutting structural checks for the admin-mutation performance pass:
 * every mutation form disables its submit control while pending (no
 * double-submission), the final two product-variant writes run concurrently
 * instead of one after another, and revalidation stays scoped to the domain
 * that actually changed (a delivery-zone edit must never bust the product/
 * category/promotion storefront cache, and vice versa).
 */

const productForm = readFileSync("src/components/admin/products/ProductForm.tsx", "utf8");
const settlementForm = readFileSync("src/components/admin/settlements/SettlementForm.tsx", "utf8");
const deliveryZoneForm = readFileSync("src/components/admin/delivery-zones/DeliveryZoneForm.tsx", "utf8");
const categoryForm = readFileSync("src/components/admin/categories/CategoryForm.tsx", "utf8");
const promotionForm = readFileSync("src/components/admin/promotions/PromotionForm.tsx", "utf8");
const orderActions = readFileSync("src/components/admin/orders/OrderActions.tsx", "utf8");

const productActions = readFileSync(
  "src/app/meshek22-control/(protected)/products/actions.ts",
  "utf8"
);
const settlementActions = readFileSync(
  "src/app/meshek22-control/(protected)/settlements/actions.ts",
  "utf8"
);
const deliveryZoneActions = readFileSync(
  "src/app/meshek22-control/(protected)/delivery-zones/actions.ts",
  "utf8"
);

describe("mutation forms disable their submit control while pending", () => {
  it.each([
    ["ProductForm", productForm],
    ["SettlementForm", settlementForm],
    ["DeliveryZoneForm", deliveryZoneForm],
    ["CategoryForm", categoryForm],
    ["PromotionForm", promotionForm],
  ])("%s ties its submit button's disabled state to isPending", (_name, source) => {
    expect(source).toMatch(/disabled=\{isPending/);
    expect(source).toMatch(/useTransition\(\)/);
  });

  it("OrderActions disables the workflow buttons while a transition is in flight", () => {
    expect(orderActions).toMatch(/disabled=\{isPending\}/);
  });
});

describe("product update: the final variant writes run concurrently", () => {
  it("upserts existing variants and inserts new ones inside one Promise.all", () => {
    const section = productActions.slice(
      productActions.indexOf("// 6+7."),
      productActions.indexOf("if (upsertResult.error)")
    );
    expect(section).toMatch(/Promise\.all\(\[/);
    expect(section).toMatch(/\.upsert\(/);
    expect(section).toMatch(/\.insert\(/);
  });
});

describe("revalidation stays scoped to the domain that changed", () => {
  it("delivery-zone mutations only ever revalidate delivery-zones and settlements paths", () => {
    const revalidateCalls = deliveryZoneActions.match(/revalidatePath\(`?"?[^)]+\)/g) ?? [];
    expect(revalidateCalls.length).toBeGreaterThan(0);
    for (const call of revalidateCalls) {
      expect(call).toMatch(/delivery-zones|settlements/);
    }
    // Must never touch the storefront catalogue cache.
    expect(deliveryZoneActions).not.toContain("revalidateStorefront");
  });

  it("settlement mutations only ever revalidate the settlements path", () => {
    const revalidateCalls = settlementActions.match(/revalidatePath\(`?"?[^)]+\)/g) ?? [];
    expect(revalidateCalls.length).toBeGreaterThan(0);
    for (const call of revalidateCalls) {
      expect(call).toMatch(/settlements/);
    }
    expect(settlementActions).not.toContain("revalidateStorefront");
  });

  it("product mutations revalidate the admin products page and the storefront catalogue, nothing unrelated", () => {
    expect(productActions).toContain(`revalidatePath(\`\${ADMIN_BASE_PATH}/products\`)`);
    expect(productActions).toContain("revalidateStorefront()");
    expect(productActions).not.toMatch(/settlements|delivery-zones/);
  });
});
