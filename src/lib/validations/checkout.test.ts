import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/validations/checkout";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const VARIANT_UUID = "0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: VALID_UUID,
    fulfillmentMethod: "delivery",
    paymentMethod: "credit_card",
    customerName: "ישראל ישראלי",
    customerPhone: "0501234567",
    customerEmail: "israel@example.com",
    deliveryNotes: "",
    deliveryZoneId: VALID_UUID,
    addressCity: "רחובות",
    addressStreet: "הרצל",
    addressHouseNumber: "12",
    addressApartment: "",
    items: [{ variantId: VARIANT_UUID, quantity: 2 }],
    ...overrides,
  };
}

describe("checkout validation", () => {
  it("accepts a complete delivery order", () => {
    const result = checkoutSchema.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  it("accepts a pickup order with no address at all", () => {
    const result = checkoutSchema.safeParse(
      baseInput({
        fulfillmentMethod: "pickup",
        deliveryZoneId: "",
        addressCity: "",
        addressStreet: "",
        addressHouseNumber: "",
      })
    );
    expect(result.success).toBe(true);
  });

  it("requires a delivery zone for a delivery order", () => {
    const result = checkoutSchema.safeParse(baseInput({ deliveryZoneId: "" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes("deliveryZoneId"))).toBe(true);
  });

  it("requires street and house number for a delivery order", () => {
    const result = checkoutSchema.safeParse(
      baseInput({ addressStreet: "", addressHouseNumber: "" })
    );
    expect(result.success).toBe(false);
    const paths = result.error!.issues.flatMap((i) => i.path);
    expect(paths).toContain("addressStreet");
    expect(paths).toContain("addressHouseNumber");
  });

  it("always requires a name and a phone number", () => {
    expect(checkoutSchema.safeParse(baseInput({ customerName: "א" })).success).toBe(false);
    expect(checkoutSchema.safeParse(baseInput({ customerPhone: "12345" })).success).toBe(false);
    expect(checkoutSchema.safeParse(baseInput({ customerPhone: "" })).success).toBe(false);
  });

  it("normalises a phone number written with dashes or spaces", () => {
    const result = checkoutSchema.safeParse(baseInput({ customerPhone: "050-123 4567" }));
    expect(result.success).toBe(true);
    expect(result.data?.customerPhone).toBe("0501234567");
  });

  it("treats an empty email as absent but rejects a malformed one", () => {
    const empty = checkoutSchema.safeParse(baseInput({ customerEmail: "" }));
    expect(empty.success).toBe(true);
    expect(empty.data?.customerEmail).toBeNull();

    expect(checkoutSchema.safeParse(baseInput({ customerEmail: "not-an-email" })).success).toBe(false);
  });

  it("accepts every fulfillment and payment combination", () => {
    for (const fulfillmentMethod of ["delivery", "pickup"]) {
      for (const paymentMethod of ["credit_card", "cash", "phone_credit"]) {
        const input =
          fulfillmentMethod === "pickup"
            ? baseInput({
                fulfillmentMethod,
                paymentMethod,
                deliveryZoneId: "",
                addressCity: "",
                addressStreet: "",
                addressHouseNumber: "",
              })
            : baseInput({ fulfillmentMethod, paymentMethod });

        const result = checkoutSchema.safeParse(input);
        expect(
          result.success,
          `${fulfillmentMethod} + ${paymentMethod} should be accepted`
        ).toBe(true);
      }
    }
  });

  it("rejects an unknown fulfillment or payment method", () => {
    expect(checkoutSchema.safeParse(baseInput({ fulfillmentMethod: "teleport" })).success).toBe(false);
    expect(checkoutSchema.safeParse(baseInput({ paymentMethod: "bitcoin" })).success).toBe(false);
  });

  it("rejects an empty cart", () => {
    expect(checkoutSchema.safeParse(baseInput({ items: [] })).success).toBe(false);
  });

  it("rejects non-positive or absurd quantities", () => {
    expect(
      checkoutSchema.safeParse(baseInput({ items: [{ variantId: VARIANT_UUID, quantity: 0 }] }))
        .success
    ).toBe(false);
    expect(
      checkoutSchema.safeParse(baseInput({ items: [{ variantId: VARIANT_UUID, quantity: -3 }] }))
        .success
    ).toBe(false);
    expect(
      checkoutSchema.safeParse(baseInput({ items: [{ variantId: VARIANT_UUID, quantity: 5000 }] }))
        .success
    ).toBe(false);
  });

  it("rejects a non-UUID idempotency key so replays cannot be forged", () => {
    expect(checkoutSchema.safeParse(baseInput({ idempotencyKey: "abc" })).success).toBe(false);
  });

  it("ignores any price, discount or total sent by the client", () => {
    const result = checkoutSchema.safeParse(
      baseInput({
        // A manipulated client might append these; the schema must not surface them,
        // and the action recomputes every amount from the database regardless.
        subtotalAgorot: 1,
        discountAgorot: 999999,
        totalAgorot: 1,
        items: [{ variantId: VARIANT_UUID, quantity: 2, priceAgorot: 1 }],
      })
    );

    expect(result.success).toBe(true);
    const parsed = result.data as Record<string, unknown>;
    expect(parsed.subtotalAgorot).toBeUndefined();
    expect(parsed.discountAgorot).toBeUndefined();
    expect(parsed.totalAgorot).toBeUndefined();
    expect(parsed.items).toEqual([{ variantId: VARIANT_UUID, quantity: 2 }]);
  });

  it("has no credit-card fields at all", () => {
    const result = checkoutSchema.safeParse(
      baseInput({
        paymentMethod: "phone_credit",
        cardNumber: "4580000000000000",
        cvv: "123",
        cardExpiry: "12/30",
      })
    );

    expect(result.success).toBe(true);
    const parsed = result.data as Record<string, unknown>;
    expect(parsed.cardNumber).toBeUndefined();
    expect(parsed.cvv).toBeUndefined();
    expect(parsed.cardExpiry).toBeUndefined();
  });
});
