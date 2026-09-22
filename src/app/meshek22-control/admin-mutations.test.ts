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
const categoryActions = readFileSync(
  "src/app/meshek22-control/(protected)/categories/actions.ts",
  "utf8"
);
const promotionActions = readFileSync(
  "src/app/meshek22-control/(protected)/promotions/actions.ts",
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

/**
 * Cuts the source of one `export async function <name>(...) { ... }` action
 * out of a whole actions.ts file, up to (but not including) the next
 * top-level `export async function` — good enough to isolate one action's
 * body in these files without a real parser, since every action here is a
 * flat top-level async function (no nested `export async function`s).
 */
function sliceFunction(source: string, fnName: string): string {
  const start = source.indexOf(`export async function ${fnName}(`);
  if (start === -1) throw new Error(`function ${fnName} not found in source`);
  const nextFnIdx = source.indexOf("export async function", start + 1);
  return nextFnIdx === -1 ? source.slice(start) : source.slice(start, nextFnIdx);
}

describe("admin UPDATE actions return success in place instead of forcing a redirect", () => {
  // The root cause of slow-feeling admin edits: completeMutation() always
  // redirect()s to the list, which pays for a fresh requireAdmin() and the
  // list page's own queries on top of the mutation's own round trips, just to
  // land on a page that doesn't show the edited row in any more detail than
  // the form already open. completeUpdateMutation() (same invalidation, no
  // redirect) is the fix — see src/lib/admin/instrumentation.ts.
  const updateFns: [string, string][] = [
    ["updateCategory", categoryActions],
    ["updateProduct", productActions],
    ["updateDeliveryZone", deliveryZoneActions],
    ["updateSettlement", settlementActions],
    ["updatePromotion", promotionActions],
  ];

  it.each(updateFns)("%s calls completeUpdateMutation, never completeMutation", (fnName, source) => {
    const fn = sliceFunction(source, fnName);
    expect(fn).toContain("completeUpdateMutation(");
    expect(fn).not.toMatch(/\bcompleteMutation\(/);
  });

  const createFns: [string, string][] = [
    ["createCategory", categoryActions],
    ["createProduct", productActions],
    ["createDeliveryZone", deliveryZoneActions],
    ["createSettlement", settlementActions],
    ["createPromotion", promotionActions],
  ];

  it.each(createFns)(
    "%s still redirects via completeMutation — there is no existing row/page to stay on after a create",
    (fnName, source) => {
      const fn = sliceFunction(source, fnName);
      expect(fn).toMatch(/\bcompleteMutation\(/);
      expect(fn).not.toContain("completeUpdateMutation(");
    }
  );

  it("every actions.ts file importing completeUpdateMutation also still imports completeMutation for its create path", () => {
    for (const source of [categoryActions, productActions, deliveryZoneActions, settlementActions, promotionActions]) {
      expect(source).toMatch(
        /import\s*\{[^}]*\bcompleteMutation\b[^}]*\bcompleteUpdateMutation\b[^}]*\}\s*from\s*"@\/lib\/admin\/instrumentation"/
      );
    }
  });
});

describe("mutation forms show an in-place saved confirmation instead of navigating away", () => {
  const forms: [string, string][] = [
    ["ProductForm", productForm],
    ["SettlementForm", settlementForm],
    ["DeliveryZoneForm", deliveryZoneForm],
    ["CategoryForm", categoryForm],
    ["PromotionForm", promotionForm],
  ];

  it.each(forms)("%s uses useSuccessFlash and shows 'עודכן בהצלחה' on the update success path", (_name, source) => {
    expect(source).toMatch(/import\s*\{\s*useSuccessFlash\s*\}\s*from\s*"@\/hooks\/useSuccessFlash"/);
    expect(source).toContain("showSaved()");
    expect(source).toContain("resetSaved()");
    expect(source).toContain("עודכן בהצלחה");
  });

  it.each(forms)("%s's submit button reads 'שומר...' while pending, not just a spinner", (_name, source) => {
    expect(source).toMatch(/isPending\s*\?\s*"שומר\.\.\."/);
  });

  it("CategoryForm/SettlementForm/DeliveryZoneForm/ProductForm reset the saved flash at the start of every new submit (a second edit shouldn't show a stale success)", () => {
    for (const source of [categoryForm, settlementForm, deliveryZoneForm, productForm]) {
      const onSubmitIdx = source.indexOf("const onSubmit = (");
      const resetIdx = source.indexOf("resetSaved()", onSubmitIdx);
      const transitionIdx = source.indexOf("startTransition(", onSubmitIdx);
      expect(resetIdx).toBeGreaterThan(onSubmitIdx);
      expect(resetIdx).toBeLessThan(transitionIdx);
    }
  });
});
