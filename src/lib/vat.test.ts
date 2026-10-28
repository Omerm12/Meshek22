import { describe, expect, it } from "vitest";
import { DELIVERY_VAT_CLASS, isVatClass, resolveSnapshotVat } from "@/lib/vat";

describe("isVatClass", () => {
  it("accepts only the two known classes", () => {
    expect(isVatClass("standard")).toBe(true);
    expect(isVatClass("zero_rated")).toBe(true);
    expect(isVatClass("exempt")).toBe(false);
    expect(isVatClass("")).toBe(false);
    expect(isVatClass(null)).toBe(false);
    expect(isVatClass(undefined)).toBe(false);
  });
});

describe("resolveSnapshotVat", () => {
  it("reads a stored class and is not legacy", () => {
    expect(resolveSnapshotVat({ product_name: "x", vat_class: "zero_rated" })).toEqual({
      vatClass: "zero_rated",
      legacy: false,
    });
    expect(resolveSnapshotVat({ vat_class: "standard" })).toEqual({
      vatClass: "standard",
      legacy: false,
    });
  });

  it("treats a missing snapshot field as legacy → standard, flagged for review", () => {
    expect(resolveSnapshotVat({ product_name: "x", variant_label: "y" })).toEqual({
      vatClass: "standard",
      legacy: true,
    });
  });

  it("treats null, non-object and invalid values as legacy → standard", () => {
    for (const bad of [null, undefined, "zero_rated", 5, { vat_class: "nope" }, { vat_class: null }]) {
      expect(resolveSnapshotVat(bad)).toEqual({ vatClass: "standard", legacy: true });
    }
  });
});

describe("delivery VAT assumption", () => {
  it("is standard until the accountant confirms otherwise", () => {
    expect(DELIVERY_VAT_CLASS).toBe("standard");
  });
});
