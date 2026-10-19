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

describe("product create/update: one RPC call, not a sequence of REST requests", () => {
  // Used to be 3-4 sequential groups of Supabase calls (update+read →
  // clear-defaults+delete → upsert+insert) — each one a full network round
  // trip to the DB. admin_save_product_with_variants
  // (20260923000000_admin_product_variants_rpc.sql) folds all of it into one
  // PostgREST call executed as one Postgres transaction.
  it.each([
    ["createProduct", "createProduct"],
    ["updateProduct", "updateProduct"],
  ])("%s calls admin_save_product_with_variants exactly once, with no direct product_variants writes", (_label, fnName) => {
    const fn = sliceFunction(productActions, fnName);
    const rpcCalls = fn.match(/\.rpc\(/g) ?? [];
    expect(rpcCalls.length).toBe(1);
    expect(fn).toContain('"admin_save_product_with_variants"');
    expect(fn).not.toMatch(/\.from\("product_variants"\)/);
  });

  it("updateProduct returns the RPC's variant list so the client can reconcile ids", () => {
    const fn = sliceFunction(productActions, "updateProduct");
    expect(fn).toMatch(/variants:\s*savedVariants/);
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

const instrumentation = readFileSync("src/lib/admin/instrumentation.ts", "utf8");
const ordersActions = readFileSync(
  "src/app/meshek22-control/(protected)/orders/actions.ts",
  "utf8"
);

describe("mutation invalidation is deferred to after(), not run inline in the action body", () => {
  // Confirmed via node_modules/next/dist/server/app-render/action-handler.js:
  // calling revalidatePath/revalidateTag/updateTag ANYWHERE inline in a
  // Server Action's synchronous body sets a request-wide (not path-scoped)
  // flag that makes Next.js re-render whatever page the action was invoked
  // from as part of that action's own response — wasted work when the admin
  // stays on the same form/page and never asked for a refresh. Running
  // invalidation through runAfterResponse()/after() avoids that: nothing
  // revalidates until after the response is already on its way.

  it("finishMutation() (shared by every create/update action) defers invalidation via runAfterResponse", () => {
    const fnIdx = instrumentation.indexOf("async function finishMutation(");
    const fnEnd = instrumentation.indexOf("\n}\n", fnIdx);
    const body = instrumentation.slice(fnIdx, fnEnd);
    expect(body).toContain("runAfterResponse(() => {");
    expect(body).toContain("invalidate();");
    // The invalidate() call must be INSIDE the runAfterResponse callback,
    // not called directly beforehand.
    expect(body.indexOf("runAfterResponse(")).toBeLessThan(body.indexOf("invalidate();"));
  });

  it("applyOrderTransition's revalidation also goes through runAfterResponse, via scheduleOrderRevalidation", () => {
    expect(ordersActions).toContain("import { withAdminTiming, runAfterResponse }");
    const fnIdx = ordersActions.indexOf("function scheduleOrderRevalidation(");
    const fnEnd = ordersActions.indexOf("\n}\n", fnIdx);
    const body = ordersActions.slice(fnIdx, fnEnd);
    expect(body).toContain("runAfterResponse(() => {");
    expect(body).toContain("revalidatePath(");

    // Both call sites inside applyOrderTransition use the helper, not their
    // own inline revalidatePath calls.
    const callSites = ordersActions.match(/scheduleOrderRevalidation\(orderId\);/g) ?? [];
    expect(callSites.length).toBe(2);
  });

  it("runAfterResponse is exported from the shared instrumentation module, not reimplemented per call site", () => {
    expect(instrumentation).toContain("export function runAfterResponse(");
  });
});

describe("admin DELETE actions (and the promotion toggle) defer invalidation instead of running it inline", () => {
  // Same bug class as the update path, found independently of it: every
  // delete* action (and setPromotionActive) used to call
  // revalidatePath/revalidateStorefront synchronously and return a literal
  // `{ success: true }`, which — like the pre-fix update actions — forces
  // Next.js to re-render whatever page the action was invoked from as part
  // of the action's own response. completeDeleteMutation (a named alias for
  // the same finishMutation() completeUpdateMutation uses — see
  // instrumentation.ts) fixes this the same way.
  const deleteFns: [string, string][] = [
    ["deleteProduct", productActions],
    ["deleteCategory", categoryActions],
    ["deleteDeliveryZone", deliveryZoneActions],
    ["deleteSettlement", settlementActions],
    ["deletePromotion", promotionActions],
  ];

  it.each(deleteFns)("%s calls completeDeleteMutation, not an inline revalidate + literal return", (fnName, source) => {
    const fn = sliceFunction(source, fnName);
    expect(fn).toContain("completeDeleteMutation(");
    expect(fn).not.toMatch(/return\s*\{\s*success:\s*true\s*\}/);
  });

  it("setPromotionActive also defers invalidation (via completeUpdateMutation — it's a field toggle, not a delete)", () => {
    const fn = sliceFunction(promotionActions, "setPromotionActive");
    expect(fn).toContain("completeUpdateMutation(");
    expect(fn).not.toMatch(/return\s*\{\s*success:\s*true\s*\}/);
  });

  it("every actions.ts file with a delete action imports completeDeleteMutation", () => {
    for (const source of [productActions, categoryActions, deliveryZoneActions, settlementActions, promotionActions]) {
      expect(source).toMatch(
        /import\s*\{[^}]*\bcompleteDeleteMutation\b[^}]*\}\s*from\s*"@\/lib\/admin\/instrumentation"/
      );
    }
  });
});

describe("delete buttons update the UI locally instead of calling router.refresh()", () => {
  // The server-side fix above (completeDeleteMutation) is necessary but not
  // sufficient on its own: every delete button/row-action component called
  // router.refresh() on success regardless, which forces Next.js to re-run
  // the whole list page's own Server Component query just to remove one row
  // — the same "forced re-render of the page you're already on" cost, just
  // triggered by the client this time instead of the server. hideDeletedRow
  // (src/lib/admin/hide-row.ts) removes the row's own DOM node instead.
  const deleteButtons: [string, string][] = [
    ["DeleteProductButton", "src/components/admin/products/DeleteProductButton.tsx"],
    ["DeleteCategoryButton", "src/components/admin/categories/DeleteCategoryButton.tsx"],
    ["DeleteDeliveryZoneButton", "src/components/admin/delivery-zones/DeleteDeliveryZoneButton.tsx"],
    ["DeleteSettlementButton", "src/components/admin/settlements/DeleteSettlementButton.tsx"],
    ["PromotionRowActions", "src/components/admin/promotions/PromotionRowActions.tsx"],
  ];

  it.each(deleteButtons)("%s calls hideDeletedRow, never router.refresh()", (_name, path) => {
    const source = readFileSync(path, "utf8");
    expect(source).toContain("hideDeletedRow(");
    expect(source).not.toContain("router.refresh()");
    expect(source).not.toMatch(/useRouter/);
  });

  it("PromotionRowActions applies a successful toggle to local state instead of refreshing", () => {
    const source = readFileSync("src/components/admin/promotions/PromotionRowActions.tsx", "utf8");
    expect(source).toContain("setLocalIsActive(");
  });
});

describe("high-fanout admin row links disable automatic prefetch", () => {
  // Default Next.js Link prefetch fires for every link scrolled into
  // viewport in a production build — each one re-runs the full admin auth
  // chain (Middleware + requireAdmin). Row-level edit/view links (up to
  // PAGE_SIZE per page, or unbounded for promotions/orders) are the
  // high-fanout case within a single list. The sidebar nav and the
  // dashboard's tiles/recent-order links are a DIFFERENT high-fanout case:
  // a fixed but still sizeable set (7 nav links + 5 attention cards + 5
  // config tiles + up to 10 recent orders = 27+) that all mount TOGETHER on
  // the very first page after login. Verified live: logging in triggered a
  // burst of concurrent admin-auth-chain requests (one per link) with one
  // request measured at 3346ms while a sibling took 402ms — the same
  // "requests started simultaneously, one much slower" shape as the
  // original production evidence this whole investigation started from.
  // Pagination prev/next (2 links, clicked with strong intent) is the one
  // remaining case left at the default.
  const pagesWithRowLinks: [string, string][] = [
    ["products list", "src/app/meshek22-control/(protected)/products/page.tsx"],
    ["categories list", "src/app/meshek22-control/(protected)/categories/page.tsx"],
    ["delivery-zones list", "src/app/meshek22-control/(protected)/delivery-zones/page.tsx"],
    ["settlements list", "src/app/meshek22-control/(protected)/settlements/page.tsx"],
    ["promotions list", "src/app/meshek22-control/(protected)/promotions/page.tsx"],
    ["orders list", "src/components/admin/orders/OrdersListClient.tsx"],
    ["admin sidebar nav", "src/components/admin/AdminSidebar.tsx"],
  ];

  it.each(pagesWithRowLinks)("%s's row-level Link sets prefetch={false}", (_name, path) => {
    const source = readFileSync(path, "utf8");
    expect(source).toContain("prefetch={false}");
  });

  it("the dashboard disables prefetch on all four of its high-fanout Link sites (attention cards, config tiles, recent orders, view-all)", () => {
    const source = readFileSync("src/app/meshek22-control/(protected)/page.tsx", "utf8");
    const occurrences = source.match(/prefetch=\{false\}/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
  });
});
