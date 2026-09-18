import { describe, expect, it } from "vitest";
import { isKilogramVariant, pickInitialVariant } from "@/lib/data/variant-selection";
import type { MockVariant } from "@/lib/data/mock";

function variant(overrides: Partial<MockVariant> = {}): MockVariant {
  return {
    id: "v1",
    label: "יחידה",
    unit: "unit",
    priceAgorot: 500,
    comparePriceAgorot: null,
    isDefault: false,
    quantityPricingMode: "fixed",
    quantityStep: 1,
    minQuantity: 1,
    ...overrides,
  };
}

describe("isKilogramVariant", () => {
  it("recognises the structured unit field, not the Hebrew label", () => {
    expect(isKilogramVariant(variant({ unit: "1kg", label: "משהו אחר" }))).toBe(true);
  });

  it("does not treat 2kg, 500g or a look-alike label as a kilogram variant", () => {
    expect(isKilogramVariant(variant({ unit: "2kg" }))).toBe(false);
    expect(isKilogramVariant(variant({ unit: "500g" }))).toBe(false);
    // A "unit" variant an admin happened to label like a kilogram must not
    // fool a fragile label comparison — there isn't one here, but this pins
    // that the check really is unit-based.
    expect(isKilogramVariant(variant({ unit: "unit", label: '1 ק"ג' }))).toBe(false);
  });
});

describe("pickInitialVariant", () => {
  it("selects the kilogram variant even when a different variant is flagged is_default", () => {
    const unit = variant({ id: "unit", unit: "unit", isDefault: true });
    const kg = variant({ id: "kg", unit: "1kg", isDefault: false });
    expect(pickInitialVariant([unit, kg])?.id).toBe("kg");
  });

  it("selects the kilogram variant even when it appears first in the array", () => {
    const kg = variant({ id: "kg", unit: "1kg", isDefault: false });
    const unit = variant({ id: "unit", unit: "unit", isDefault: true });
    expect(pickInitialVariant([kg, unit])?.id).toBe("kg");
  });

  it("falls back to the admin's is_default flag when there is no kilogram variant", () => {
    const unit = variant({ id: "unit", unit: "unit", isDefault: false });
    const pack = variant({ id: "pack", unit: "pack", isDefault: true });
    expect(pickInitialVariant([unit, pack])?.id).toBe("pack");
  });

  it("falls back to the first variant when nothing is flagged default and there is no kilogram option", () => {
    const first = variant({ id: "first", unit: "unit" });
    const second = variant({ id: "second", unit: "pack" });
    expect(pickInitialVariant([first, second])?.id).toBe("first");
  });

  it("the selected variant carries its own correct price", () => {
    const unit = variant({ id: "unit", unit: "unit", isDefault: true, priceAgorot: 500 });
    const kg = variant({ id: "kg", unit: "1kg", isDefault: false, priceAgorot: 1290 });
    expect(pickInitialVariant([unit, kg])).toMatchObject({ id: "kg", priceAgorot: 1290 });
  });

  it("returns undefined for an empty list", () => {
    expect(pickInitialVariant([])).toBeUndefined();
  });
});
