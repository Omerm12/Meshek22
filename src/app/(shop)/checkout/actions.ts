"use server";

import { createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { createCardComSession, type CardComLineItem } from "@/lib/cardcom";
import { calculateCartPricing } from "@/lib/promotions/engine";
import type { PricedItem, Promotion } from "@/lib/promotions/types";
import { toPromotion } from "@/lib/data/promotions";
import { checkoutSchema } from "@/lib/validations/checkout";
import {
  PICKUP_LOCATION,
  type FulfillmentMethod,
  type PaymentMethod,
} from "@/lib/checkout/constants";
import {
  createGuestAccessToken,
  hashGuestAccessToken,
  isPlausibleGuestToken,
} from "@/lib/checkout/guest-token";
import { sendOrderEmails } from "@/lib/email/order-emails";

/**
 * Guest checkout.
 *
 * Security model
 * --------------
 * • No customer account exists, so nothing is trusted from the session either.
 *   The browser sends variant ids and quantities and NOTHING ELSE that affects
 *   money: prices, promotions, delivery fees, discounts and totals are all read
 *   or recomputed here from the database.
 * • The promotion engine used here is the same pure module the cart renders
 *   with, so a manipulated client total simply loses — the server figure wins
 *   and is what gets stored and charged.
 * • Order creation goes through create_guest_order_atomic(), a SECURITY DEFINER
 *   RPC granted to service_role only. anon cannot call it, so a guest can never
 *   insert an order directly. The RPC itself re-verifies that the totals balance.
 * • Because a guest order has no owner, reading it back requires a 256-bit
 *   access token minted at creation; only its SHA-256 hash is stored. The order
 *   number alone is never sufficient.
 * • payment_status becomes "paid" only through the verified CardCom webhook —
 *   never from a redirect, and never from this action.
 */

type CreateOrderSuccess = {
  orderNumber: string;
  accessToken: string;
  /** Present only for the online-card flow: the CardCom hosted page. */
  paymentUrl?: string;
  /** Where the browser should go for cash / phone-credit orders. */
  successUrl: string;
};

type CreateOrderResult = { error: string } | CreateOrderSuccess;

/** Deliberately vague: it must not reveal whether some other order exists. */
const GENERIC_LOOKUP_ERROR = "ההזמנה לא נמצאה";

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function buildSuccessUrl(orderNumber: string, token: string): string {
  return `${siteOrigin()}/checkout/success?order=${encodeURIComponent(orderNumber)}&t=${encodeURIComponent(token)}`;
}

/** Failure URL carries the token so "נסה שוב" can authorise a new attempt. */
function buildFailureUrl(orderId: string, token: string): string {
  return `${siteOrigin()}/checkout/payment-error?orderId=${encodeURIComponent(orderId)}&t=${encodeURIComponent(token)}`;
}

// ─── Order creation ───────────────────────────────────────────────────────────

export async function createOrder(formData: FormData): Promise<CreateOrderResult> {
  // ── 1. Parse and validate everything the browser sent ─────────────────────
  let rawItems: unknown;
  try {
    rawItems = JSON.parse((formData.get("cart_items") as string | null) ?? "[]");
  } catch {
    return { error: "נתוני הסל אינם תקינים" };
  }

  const parsed = checkoutSchema.safeParse({
    idempotencyKey:     formData.get("idempotency_key") ?? "",
    fulfillmentMethod:  formData.get("fulfillment_method") ?? "delivery",
    paymentMethod:      formData.get("payment_method") ?? "credit_card",
    customerName:       formData.get("customer_name") ?? "",
    customerPhone:      formData.get("customer_phone") ?? "",
    customerEmail:      formData.get("customer_email") ?? "",
    deliveryNotes:      formData.get("delivery_notes") ?? "",
    deliveryZoneId:     formData.get("delivery_zone_id") ?? "",
    addressCity:        formData.get("address_city") ?? "",
    addressStreet:      formData.get("address_street") ?? "",
    addressHouseNumber: formData.get("address_house_number") ?? "",
    addressApartment:   formData.get("address_apartment") ?? "",
    items:              rawItems,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "הפרטים שהוזנו אינם תקינים" };
  }

  const input = parsed.data;
  const fulfillmentMethod = input.fulfillmentMethod as FulfillmentMethod;
  const paymentMethod = input.paymentMethod as PaymentMethod;

  const db = createAdminClient();

  // ── 2. Re-read every price from the database ──────────────────────────────
  const variantIds = [...new Set(input.items.map((i) => i.variantId))];

  const [variantsRes, promotionsRes] = await Promise.all([
    db
      .from("product_variants")
      .select(
        "id, price_agorot, is_available, label, quantity_pricing_mode, " +
          "products!inner(id, name, is_active, qty_deal_enabled, qty_deal_quantity, qty_deal_price_agorot)"
      )
      .in("id", variantIds),
    db
      .from("promotions")
      .select(
        "id, name, description, promotion_type, required_quantity, bundle_price_agorot, " +
          "is_active, starts_at, ends_at, sort_order, promotion_items ( product_variant_id )"
      )
      .eq("is_active", true),
  ]);

  if (variantsRes.error || !variantsRes.data) {
    console.error("[createOrder] variant fetch failed", { error: variantsRes.error?.message });
    return { error: "שגיאה באימות המוצרים. נא לנסות שוב." };
  }

  type VariantRow = {
    id: string;
    price_agorot: number;
    is_available: boolean;
    label: string;
    quantity_pricing_mode: "fixed" | "per_kg";
    products: {
      id: string;
      name: string;
      is_active: boolean;
      qty_deal_enabled: boolean | null;
      qty_deal_quantity: number | null;
      qty_deal_price_agorot: number | null;
    } | null;
  };

  const variantMap = new Map(
    (variantsRes.data as unknown as VariantRow[]).map((v) => [v.id, v])
  );

  // Expired/disabled promotions are filtered out by the engine's own live check,
  // so a promotion that lapsed between page load and submit simply stops applying.
  const promotions: Promotion[] = promotionsRes.error
    ? []
    : (promotionsRes.data as unknown as Parameters<typeof toPromotion>[0][]).map(toPromotion);

  const pricedItems: PricedItem[] = [];
  const lineMeta: { variantId: string; label: string; productName: string }[] = [];

  for (const item of input.items) {
    const variant = variantMap.get(item.variantId);
    if (!variant || !variant.products) {
      return { error: "אחד המוצרים בסל אינו זמין יותר. נא לרענן את הסל." };
    }
    if (!variant.is_available || !variant.products.is_active) {
      return { error: `המוצר "${variant.products.name}" אינו זמין כרגע` };
    }
    // Fixed-price variants are sold in whole units only.
    if (variant.quantity_pricing_mode === "fixed" && !Number.isInteger(item.quantity)) {
      return { error: `כמות לא תקינה עבור "${variant.products.name}"` };
    }

    pricedItems.push({
      variantId:           variant.id,
      productId:           variant.products.id,
      quantity:            item.quantity,
      priceAgorot:         variant.price_agorot,
      quantityPricingMode: variant.quantity_pricing_mode,
      dealEnabled:         variant.products.qty_deal_enabled ?? false,
      dealQuantity:        variant.products.qty_deal_quantity,
      dealPriceAgorot:     variant.products.qty_deal_price_agorot,
    });

    lineMeta.push({
      variantId:   variant.id,
      label:       variant.label,
      productName: variant.products.name,
    });
  }

  // ── 3. Authoritative pricing ──────────────────────────────────────────────
  const pricing = calculateCartPricing(pricedItems, promotions);
  const subtotalAgorot = pricing.subtotalAgorot;
  const discountAgorot = pricing.discountAgorot;

  // ── 4. Fulfillment: fee, minimum, address snapshot ────────────────────────
  let deliveryFeeAgorot = 0;
  let deliveryZoneId: string | null = null;
  let deliveryAddressSnapshot: Json;

  if (fulfillmentMethod === "delivery") {
    const { data: zoneRow, error: zoneError } = await db
      .from("delivery_zones")
      .select("id, name, delivery_fee_agorot, free_delivery_threshold_agorot, min_order_agorot")
      .eq("id", input.deliveryZoneId!)
      .eq("is_active", true)
      .maybeSingle();

    if (zoneError || !zoneRow) {
      console.error("[createOrder] delivery zone lookup failed", {
        deliveryZoneId: input.deliveryZoneId,
        supabaseError: zoneError?.message ?? "no matching row",
      });
      return { error: "אזור המשלוח לא נמצא במערכת. נא לפנות לתמיכה." };
    }

    // The minimum and the free-delivery threshold are both judged on the amount
    // the customer actually pays for goods, after promotions.
    const goodsTotal = pricing.chargedSubtotalAgorot;

    if (zoneRow.min_order_agorot !== null && goodsTotal < zoneRow.min_order_agorot) {
      const minFmt    = (zoneRow.min_order_agorot / 100).toLocaleString("he-IL");
      const shortFmt  = ((zoneRow.min_order_agorot - goodsTotal) / 100).toLocaleString("he-IL");
      return {
        error: `ההזמנה המינימלית ל${input.addressCity} היא ₪${minFmt}. חסרים עוד ₪${shortFmt}.`,
      };
    }

    const isFreeDelivery =
      zoneRow.free_delivery_threshold_agorot !== null &&
      goodsTotal >= zoneRow.free_delivery_threshold_agorot;

    deliveryFeeAgorot = isFreeDelivery ? 0 : zoneRow.delivery_fee_agorot;
    deliveryZoneId = zoneRow.id;

    deliveryAddressSnapshot = {
      fulfillment_method: "delivery",
      street:             input.addressStreet!,
      house_number:       input.addressHouseNumber!,
      apartment:          input.addressApartment,
      city:               input.addressCity!,
      zone_name:          zoneRow.name,
      zone_id:            zoneRow.id,
    } satisfies Json;
  } else {
    // Pickup: no zone, no address, no minimum, and the fee is always zero.
    deliveryAddressSnapshot = {
      fulfillment_method: "pickup",
      pickup_location:    PICKUP_LOCATION.name,
      pickup_note:        PICKUP_LOCATION.coordinationNote,
    } satisfies Json;
  }

  const totalAgorot = subtotalAgorot + deliveryFeeAgorot - discountAgorot;

  if (totalAgorot < 0) {
    // Unreachable: the engine clamps every discount to the line value. Guard
    // anyway so a future change can never charge a negative amount.
    console.error("[createOrder] negative total blocked", { subtotalAgorot, discountAgorot });
    return { error: "שגיאה בחישוב ההזמנה. נא לפנות לתמיכה." };
  }

  // ── 5. Order + item payloads ──────────────────────────────────────────────
  const customerSnapshot: Json = {
    name:  input.customerName,
    phone: input.customerPhone,
    email: input.customerEmail,
  };

  const discountBreakdown: Json = pricing.appliedPromotions.map((p) => ({
    promotion_id:        p.source === "group" ? p.promotionId : null,
    name:                p.name,
    required_quantity:   p.requiredQuantity,
    bundle_price_agorot: p.bundlePriceAgorot,
    groups_applied:      p.groupsApplied,
    discount_agorot:     p.discountAgorot,
    source:              p.source,
  }));

  const promotionByLineId = new Map(
    pricing.appliedPromotions.map((p) => [p.promotionId, p])
  );

  const itemsJson: Json = pricing.lines.map((line, index) => {
    const meta = lineMeta[index];
    const applied = line.appliedPromotionId
      ? promotionByLineId.get(line.appliedPromotionId)
      : undefined;

    return {
      product_variant_id: line.variantId,
      product_snapshot: {
        product_name:  meta.productName,
        variant_label: meta.label,
        price_agorot:  line.unitPriceAgorot,
      },
      quantity:           line.quantity,
      unit_price_agorot:  line.unitPriceAgorot,
      total_price_agorot: line.normalTotalAgorot,
      discount_agorot:    line.discountAgorot,
      // Legacy deals have a synthetic id and no promotions row to reference.
      promotion_id:       applied?.source === "group" ? applied.promotionId : null,
      promotion_snapshot: applied
        ? {
            name:                applied.name,
            required_quantity:   applied.requiredQuantity,
            bundle_price_agorot: applied.bundlePriceAgorot,
            source:              applied.source,
          }
        : null,
    };
  });

  // Online card payments stay pending until the CardCom webhook verifies them.
  // Cash orders are operationally confirmed straight away — the shop will pack
  // them — while the money is still outstanding, so payment_status stays pending.
  const orderStatus = paymentMethod === "cash" ? "confirmed" : "pending_payment";
  const paymentStatus = "pending";

  const accessToken = createGuestAccessToken();

  // ── 6. Atomic creation ────────────────────────────────────────────────────
  const { data: rpcResult, error: rpcError } = await db.rpc("create_guest_order_atomic", {
    p_idempotency_key:     input.idempotencyKey,
    p_fulfillment_method:  fulfillmentMethod,
    p_delivery_zone_id:    deliveryZoneId,
    p_delivery_address:    deliveryAddressSnapshot,
    p_customer:            customerSnapshot,
    p_subtotal_agorot:     subtotalAgorot,
    p_delivery_fee_agorot: deliveryFeeAgorot,
    p_discount_agorot:     discountAgorot,
    p_total_agorot:        totalAgorot,
    p_delivery_notes:      input.deliveryNotes,
    p_payment_method:      paymentMethod,
    p_order_status:        orderStatus,
    p_payment_status:      paymentStatus,
    p_guest_token_hash:    hashGuestAccessToken(accessToken),
    p_discount_breakdown:  discountBreakdown,
    p_items:               itemsJson,
  });

  if (rpcError || !rpcResult || rpcResult.length === 0) {
    console.error("[createOrder] create_guest_order_atomic failed", { error: rpcError?.message });
    return { error: "שגיאה ביצירת ההזמנה. נא לנסות שוב." };
  }

  const { out_order_id: orderId, out_order_number: orderNumber, out_is_duplicate: isDuplicate } =
    rpcResult[0];

  const successUrl = buildSuccessUrl(orderNumber, accessToken);

  // ── 7. Offline payment methods: done here, no CardCom involved ────────────
  if (paymentMethod === "cash" || paymentMethod === "phone_credit") {
    // Emails are idempotent at the database level, so an idempotent replay of
    // the same submission does not produce a second message.
    await sendOrderEmails(orderId, db);
    return { orderNumber, accessToken, successUrl };
  }

  // ── 8. Online card: hand over to CardCom ──────────────────────────────────
  if (isDuplicate) {
    const { data: existingOrder } = await db
      .from("orders")
      .select("payment_status")
      .eq("id", orderId)
      .single();

    if (existingOrder?.payment_status === "paid") {
      return { orderNumber, accessToken, successUrl };
    }

    // A previous attempt may have left the order "failed"; reset to pending so
    // the new session's webhook can apply its compare-and-set update.
    if (existingOrder?.payment_status === "failed") {
      await db
        .from("orders")
        .update({ payment_status: "pending", updated_at: new Date().toISOString() })
        .eq("id", orderId);
    }
  }

  // Line totals sent to CardCom are the amounts actually charged (normal minus
  // the allocated promotion discount), so the CardCom document adds up to
  // exactly the Amount we ask it to charge, with no negative lines.
  const cardComLineItems: CardComLineItem[] = pricing.lines.map((line, index) => ({
    productId:        line.variantId,
    description:      `${lineMeta[index].productName} — ${lineMeta[index].label}`,
    quantity:         line.quantity,
    unitPriceAgorot:  line.unitPriceAgorot,
    totalPriceAgorot: line.chargedTotalAgorot,
  }));

  let cardComSession: Awaited<ReturnType<typeof createCardComSession>>;
  try {
    cardComSession = await createCardComSession({
      orderId,
      orderNumber,
      totalAgorot,
      customerName:  input.customerName,
      customerEmail: input.customerEmail ?? "",
      customerPhone: input.customerPhone,
      lineItems:     cardComLineItems,
      deliveryFeeAgorot,
      successUrl,
      failureUrl:    buildFailureUrl(orderId, accessToken),
    });
  } catch (e) {
    console.error("[createOrder] CardCom session creation failed", e);
    return { error: "שגיאה בתחילת תהליך התשלום. נא לנסות שוב או לפנות לתמיכה." };
  }

  await db
    .from("orders")
    .update({ payment_reference: cardComSession.lowProfileId })
    .eq("id", orderId);

  // The cart is NOT cleared here. It is cleared only after the webhook confirms
  // payment, so a cancelled or failed payment leaves the basket intact.
  return {
    orderNumber,
    accessToken,
    paymentUrl: cardComSession.paymentUrl,
    successUrl,
  };
}

// ─── Guest order lookup ───────────────────────────────────────────────────────

export interface GuestOrderStatus {
  orderNumber: string;
  paymentStatus: string;
  orderStatus: string;
}

/**
 * Payment status for the success page poller.
 *
 * Requires BOTH the order number and the access token: the query matches on the
 * token hash, so knowing (or guessing) an order number achieves nothing. Every
 * failure returns null — the caller cannot distinguish "no such order" from
 * "wrong token".
 */
export async function getGuestOrderStatus(
  orderNumber: string,
  token: string
): Promise<GuestOrderStatus | null> {
  if (!orderNumber || !isPlausibleGuestToken(token)) return null;

  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select("order_number, payment_status, order_status")
    .eq("order_number", orderNumber)
    .eq("guest_access_token_hash", hashGuestAccessToken(token))
    .maybeSingle();

  if (!data) return null;

  return {
    orderNumber:   data.order_number,
    paymentStatus: data.payment_status,
    orderStatus:   data.order_status,
  };
}

// ─── Payment retry ────────────────────────────────────────────────────────────

type RetryResult = { error: string } | { paymentUrl: string; orderNumber: string };

/**
 * Create a fresh CardCom session for an existing pending/failed guest order.
 *
 * Authorisation is the access token, not a login. The stored payment_reference
 * is replaced with the new LowProfileId, so a late webhook from the abandoned
 * session is rejected by the existing LowProfileId mismatch check.
 */
export async function retryPayment(orderId: string, token: string): Promise<RetryResult> {
  if (!isPlausibleGuestToken(token)) {
    return { error: GENERIC_LOOKUP_ERROR };
  }

  const db = createAdminClient();

  const { data: order } = await db
    .from("orders")
    .select(
      "id, order_number, payment_status, payment_method, total_agorot, delivery_fee_agorot, customer_snapshot"
    )
    .eq("id", orderId)
    .eq("guest_access_token_hash", hashGuestAccessToken(token))
    .maybeSingle();

  if (!order) {
    console.warn("[retryPayment]", { event: "order_not_found_or_bad_token", orderId });
    return { error: GENERIC_LOOKUP_ERROR };
  }

  if (order.payment_method !== "credit_card") {
    return { error: "לא ניתן לשלם הזמנה זו באשראי באתר" };
  }

  if (order.payment_status === "paid") {
    return { paymentUrl: buildSuccessUrl(order.order_number, token), orderNumber: order.order_number };
  }

  if (order.payment_status !== "pending" && order.payment_status !== "failed") {
    return { error: "לא ניתן לנסות שוב הזמנה זו" };
  }

  const { data: orderItems } = await db
    .from("order_items")
    .select("product_variant_id, product_snapshot, quantity, unit_price_agorot, total_price_agorot, discount_agorot")
    .eq("order_id", orderId);

  if (!orderItems || orderItems.length === 0) {
    console.error("[retryPayment]", { event: "no_order_items", orderId });
    return { error: GENERIC_LOOKUP_ERROR };
  }

  const customer = order.customer_snapshot as
    | { name?: string; email?: string; phone?: string }
    | null;

  type ItemSnap = { product_name: string; variant_label: string };
  const lineItems: CardComLineItem[] = orderItems.map((item) => {
    const snap = item.product_snapshot as unknown as ItemSnap;
    return {
      productId:        item.product_variant_id,
      description:      `${snap.product_name} — ${snap.variant_label}`,
      quantity:         item.quantity,
      unitPriceAgorot:  item.unit_price_agorot,
      totalPriceAgorot: item.total_price_agorot - (item.discount_agorot ?? 0),
    };
  });

  if (order.payment_status === "failed") {
    await db
      .from("orders")
      .update({ payment_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", orderId);
  }

  let cardComSession: Awaited<ReturnType<typeof createCardComSession>>;
  try {
    cardComSession = await createCardComSession({
      orderId:           order.id,
      orderNumber:       order.order_number,
      totalAgorot:       order.total_agorot,
      customerName:      customer?.name  ?? "",
      customerEmail:     customer?.email ?? "",
      customerPhone:     customer?.phone ?? "",
      lineItems,
      deliveryFeeAgorot: order.delivery_fee_agorot,
      successUrl:        buildSuccessUrl(order.order_number, token),
      failureUrl:        buildFailureUrl(order.id, token),
    });
  } catch (e) {
    console.error("[retryPayment]", { event: "cardcom_session_failed", orderId, error: e });
    await db
      .from("orders")
      .update({ payment_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("payment_status", "pending");
    return { error: "שגיאה בתחילת תהליך התשלום. נא לנסות שוב." };
  }

  await db
    .from("orders")
    .update({ payment_reference: cardComSession.lowProfileId })
    .eq("id", orderId);

  return { paymentUrl: cardComSession.paymentUrl, orderNumber: order.order_number };
}
