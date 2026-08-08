import { z } from "zod";
import { FULFILLMENT_METHODS, PAYMENT_METHODS } from "@/lib/checkout/constants";

/**
 * Server-side checkout validation.
 *
 * Everything a guest submits passes through here before it reaches the database.
 * Note what is deliberately absent: prices, discounts and totals. Those are
 * never accepted from the browser — the Server Action recomputes them from the
 * catalog, so a tampered payload cannot change what is charged.
 *
 * There are also no credit-card fields anywhere in this schema. Card data is
 * only ever entered on CardCom's hosted page; the "נציג יתקשר" option records
 * nothing more than the customer's request to be called.
 */

const UUID = z.string().uuid("מזהה לא תקין");

/** Israeli mobile/landline: 9–10 digits starting with 0. */
const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[-\s]/g, ""))
  .pipe(z.string().regex(/^0\d{8,9}$/, "מספר טלפון לא תקין (לדוגמה: 0501234567)"));

export const cartItemInputSchema = z.object({
  variantId: UUID,
  quantity: z
    .number()
    .finite("כמות לא תקינה")
    .positive("כמות לא תקינה")
    .max(999, "הכמות המקסימלית היא 999"),
});

export const checkoutSchema = z
  .object({
    idempotencyKey: z.string().uuid("מפתח ייחודיות לא תקין"),

    fulfillmentMethod: z.enum(FULFILLMENT_METHODS),
    paymentMethod: z.enum(PAYMENT_METHODS),

    customerName: z.string().trim().min(2, "נא להזין שם מלא").max(80, "השם ארוך מדי"),
    customerPhone: phoneSchema,
    // Optional so cash / pickup customers without email are not blocked. When
    // present it must be a real address, because it receives the confirmation.
    customerEmail: z
      .union([z.literal(""), z.string().trim().email("כתובת אימייל לא תקינה")])
      .transform((v) => (v === "" ? null : v)),

    deliveryNotes: z
      .string()
      .trim()
      .max(300, "ההערות ארוכות מדי")
      .optional()
      .transform((v) => (v ? v : null)),

    // Delivery-only fields. Presence is enforced by the superRefine below.
    deliveryZoneId: z.union([z.literal(""), UUID]).optional(),
    addressCity: z.string().trim().max(80).optional(),
    addressStreet: z.string().trim().max(120).optional(),
    addressHouseNumber: z.string().trim().max(20).optional(),
    addressApartment: z
      .string()
      .trim()
      .max(40)
      .optional()
      .transform((v) => (v ? v : null)),

    items: z.array(cartItemInputSchema).min(1, "הסל ריק").max(100, "יותר מדי פריטים בסל"),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentMethod !== "delivery") return;

    // Pickup orders skip every address requirement; delivery orders need them all.
    if (!data.deliveryZoneId) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryZoneId"],
        message: "לא ניתן לזהות את אזור המשלוח. נא לבחור עיר מהרשימה.",
      });
    }
    if (!data.addressCity) {
      ctx.addIssue({ code: "custom", path: ["addressCity"], message: "נא להזין עיר / יישוב" });
    }
    if (!data.addressStreet) {
      ctx.addIssue({ code: "custom", path: ["addressStreet"], message: "נא להזין שם רחוב" });
    }
    if (!data.addressHouseNumber) {
      ctx.addIssue({ code: "custom", path: ["addressHouseNumber"], message: "נא להזין מספר בית" });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
