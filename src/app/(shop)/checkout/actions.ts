"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import {
  sendCustomerOrderConfirmation,
  sendAdminNewOrderNotification,
} from "@/lib/email/service";
import type { OrderEmailData } from "@/lib/email/types";

interface CartItemInput {
  variantId: string;
  quantity: number;
  productName: string;
  variantLabel: string;
}

type CreateOrderResult = { error: string } | { paymentUrl: string; orderNumber: string };

// UUID v4 pattern — used to validate idempotency_key and delivery_zone_id
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create an order from checkout form data.
 *
 * Security model:
 * - Auth is verified server-side via supabase.auth.getUser() (JWT validation).
 * - All prices and totals are re-fetched from the DB — client values are ignored.
 * - Delivery zone is fetched by UUID from the DB — no hardcoded slug mapping.
 * - Minimum order is enforced server-side.
 * - Order + items are inserted atomically via create_order_atomic() Postgres RPC.
 * - Idempotency key (UUID generated per checkout session) prevents duplicate orders
 *   on double-click, network retry, or page refresh during submission.
 * - Mock payment update uses adminClient to bypass the missing orders_own_update
 *   RLS policy (same as the zone lookup). In production this would be a webhook.
 */
export async function createOrder(formData: FormData): Promise<CreateOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "יש להתחבר לחשבון לפני ביצוע הזמנה" };
  }

  // ── Idempotency key ────────────────────────────────────────────────────────
  // Generated once per checkout session in CheckoutForm using crypto.randomUUID().
  // Stored in a useRef so it survives re-renders but resets on page navigation.
  const idempotencyKey = (formData.get("idempotency_key") as string | null)?.trim();
  if (!idempotencyKey || !UUID_RE.test(idempotencyKey)) {
    return { error: "מפתח ייחודיות חסר או לא תקין" };
  }

  // ── Parse cart items ───────────────────────────────────────────────────────
  const cartItemsRaw = formData.get("cart_items") as string | null;
  if (!cartItemsRaw) return { error: "הסל ריק" };

  let cartItems: CartItemInput[];
  try {
    cartItems = JSON.parse(cartItemsRaw);
  } catch {
    return { error: "נתוני הסל אינם תקינים" };
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return { error: "הסל ריק" };
  }

  // ── Delivery zone ID (UUID) ────────────────────────────────────────────────
  const deliveryZoneId = (formData.get("delivery_zone_id") as string | null)?.trim();
  if (!deliveryZoneId) {
    return { error: "נא לבחור עיר שמשרתת את אזור המשלוח" };
  }
  if (!UUID_RE.test(deliveryZoneId)) {
    return { error: "מזהה אזור משלוח לא תקין" };
  }

  // ── Customer details ───────────────────────────────────────────────────────
  const customerName  = (formData.get("customer_name")  as string | null)?.trim() ?? "";
  const customerPhone = (formData.get("customer_phone") as string | null)?.trim() ?? "";
  const customerEmail = (formData.get("customer_email") as string | null)?.trim() ?? "";
  const deliveryNotes = (formData.get("delivery_notes") as string | null)?.trim() || null;

  if (customerName.length < 2)
    return { error: "נא להזין שם מלא" };
  if (!/^0\d{8,9}$/.test(customerPhone))
    return { error: "מספר טלפון לא תקין (לדוגמה: 0501234567)" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))
    return { error: "כתובת אימייל לא תקינה" };

  // ── Address fields ─────────────────────────────────────────────────────────
  const addressStreet      = (formData.get("address_street")       as string | null)?.trim() ?? "";
  const addressHouseNumber = (formData.get("address_house_number") as string | null)?.trim() ?? "";
  const addressCity        = (formData.get("address_city")         as string | null)?.trim() ?? "";
  const addressApartment   = (formData.get("address_apartment")    as string | null)?.trim() || null;

  if (!addressStreet)      return { error: "נא להזין שם רחוב" };
  if (!addressHouseNumber) return { error: "נא להזין מספר בית" };
  if (!addressCity)        return { error: "נא להזין עיר" };

  // ── Fetch delivery zone from DB ────────────────────────────────────────────
  // Admin client: delivery_zones may not have a public SELECT policy in all
  // environments. This is an internal server-side lookup only.
  const adminClient = await createAdminClient();
  const { data: zoneRow, error: zoneError } = await adminClient
    .from("delivery_zones")
    .select("id, name, delivery_fee_agorot, free_delivery_threshold_agorot, min_order_agorot")
    .eq("id", deliveryZoneId)
    .eq("is_active", true)
    .maybeSingle();

  if (zoneError || !zoneRow) {
    console.error("[createOrder] delivery zone lookup failed", {
      deliveryZoneId,
      supabaseError: zoneError?.message ?? "no matching row",
    });
    return { error: "אזור המשלוח לא נמצא במערכת. נא לפנות לתמיכה." };
  }

  // ── Fetch and validate product variants ───────────────────────────────────
  const variantIds = cartItems.map((i) => i.variantId);

  const { data: variants, error: variantError } = await supabase
    .from("product_variants")
    .select("id, price_agorot, is_available, label, products(id, name)")
    .in("id", variantIds);

  if (variantError || !variants) {
    console.error("[createOrder] variant fetch failed", { error: variantError?.message });
    return { error: "שגיאה באימות המוצרים. נא לנסות שוב." };
  }

  const variantMap = new Map(variants.map((v) => [v.id, v]));

  type LineItemData = {
    variantId: string;
    quantity: number;
    unitPriceAgorot: number;
    totalPriceAgorot: number;
    snapshot: Json;
  };

  const lineItems: LineItemData[] = [];

  for (const cartItem of cartItems) {
    if (!cartItem.variantId || typeof cartItem.quantity !== "number") {
      return { error: "נתוני מוצר לא תקינים" };
    }

    const variant = variantMap.get(cartItem.variantId);
    if (!variant) {
      return { error: `המוצר "${cartItem.productName}" אינו זמין יותר` };
    }
    if (!variant.is_available) {
      return { error: `המוצר "${cartItem.productName}" אינו זמין כרגע` };
    }
    if (cartItem.quantity < 1 || cartItem.quantity > 99) {
      return { error: `כמות לא תקינה עבור "${cartItem.productName}"` };
    }

    const unitPriceAgorot  = variant.price_agorot;
    const totalPriceAgorot = unitPriceAgorot * cartItem.quantity;

    const product = variant.products as unknown as { id: string; name: string } | null;
    const productName = product?.name ?? cartItem.productName;

    lineItems.push({
      variantId: cartItem.variantId,
      quantity:  cartItem.quantity,
      unitPriceAgorot,
      totalPriceAgorot,
      snapshot: {
        product_name:  productName,
        variant_label: variant.label,
        price_agorot:  unitPriceAgorot,
      } satisfies Json,
    });
  }

  // ── Server-side totals ─────────────────────────────────────────────────────
  const subtotalAgorot = lineItems.reduce((s, i) => s + i.totalPriceAgorot, 0);

  const isFreeDelivery =
    zoneRow.free_delivery_threshold_agorot !== null &&
    subtotalAgorot >= zoneRow.free_delivery_threshold_agorot;
  const deliveryFeeAgorot = isFreeDelivery ? 0 : zoneRow.delivery_fee_agorot;

  if (subtotalAgorot < zoneRow.min_order_agorot) {
    const minFmt    = (zoneRow.min_order_agorot / 100).toLocaleString("he-IL");
    const shortfall = zoneRow.min_order_agorot - subtotalAgorot;
    const shortFmt  = (shortfall / 100).toLocaleString("he-IL");
    return {
      error: `ההזמנה המינימלית לאזור ${zoneRow.name} היא ₪${minFmt}. חסרים עוד ₪${shortFmt}.`,
    };
  }

  const discountAgorot = 0;
  const totalAgorot    = subtotalAgorot + deliveryFeeAgorot - discountAgorot;

  // ── Build JSON blobs for the RPC ───────────────────────────────────────────
  const deliveryAddressSnapshot: Json = {
    street:       addressStreet,
    house_number: addressHouseNumber,
    apartment:    addressApartment,
    city:         addressCity,
    zone_name:    zoneRow.name,
    zone_id:      zoneRow.id,
  };

  const customerSnapshot: Json = {
    name:  customerName,
    phone: customerPhone,
    email: customerEmail,
  };

  // Each item matches the structure read by the Postgres function:
  // { product_variant_id, product_snapshot, quantity, unit_price_agorot, total_price_agorot }
  const itemsJson: Json = lineItems.map((item) => ({
    product_variant_id: item.variantId,
    product_snapshot:   item.snapshot,
    quantity:           item.quantity,
    unit_price_agorot:  item.unitPriceAgorot,
    total_price_agorot: item.totalPriceAgorot,
  }));

  // ── Atomic order creation via RPC ──────────────────────────────────────────
  // The function runs under SECURITY DEFINER but derives user_id from auth.uid()
  // (set by PostgREST from the JWT) — never trusts a caller-supplied user_id.
  // On duplicate idempotency_key it returns the existing row (out_is_duplicate = true).
  // The user client is used here so auth.uid() is populated correctly.
  const { data: rpcResult, error: rpcError } = await supabase.rpc("create_order_atomic", {
    p_idempotency_key:     idempotencyKey,
    p_delivery_zone_id:    zoneRow.id,
    p_delivery_address:    deliveryAddressSnapshot,
    p_customer:            customerSnapshot,
    p_subtotal_agorot:     subtotalAgorot,
    p_delivery_fee_agorot: deliveryFeeAgorot,
    p_discount_agorot:     discountAgorot,
    p_total_agorot:        totalAgorot,
    p_delivery_notes:      deliveryNotes,
    p_items:               itemsJson,
  });

  if (rpcError || !rpcResult || rpcResult.length === 0) {
    console.error("[createOrder] create_order_atomic RPC failed", {
      error: rpcError?.message,
    });
    return { error: "שגיאה ביצירת ההזמנה. נא לנסות שוב." };
  }

  const { out_order_id: orderId, out_order_number: orderNumber, out_is_duplicate: isDuplicate } =
    rpcResult[0];

  // ── Mock payment ───────────────────────────────────────────────────────────
  // If this is an idempotent replay AND the order was already paid, skip the
  // update and return the success URL immediately — no double payment.
  if (isDuplicate) {
    const { data: existingOrder } = await adminClient
      .from("orders")
      .select("payment_status")
      .eq("id", orderId)
      .single();

    if (existingOrder?.payment_status === "paid") {
      // Already completed — return the success URL without touching the order.
      // Clear the DB cart (idempotent — may already be empty from the first time).
      await supabase.from("user_cart_items").delete().eq("user_id", user.id);
      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      return { paymentUrl: `${origin}/checkout/success?order=${orderNumber}`, orderNumber };
    }
  }

  // TODO: Replace with PayPlus when PAYPLUS_API_KEY is configured.
  // Preserved integration point:
  //   const paymentResult = await createPaymentPage({ orderId, ... });
  //   await adminClient.from("orders").update({ payment_reference: paymentResult.paypageUid }).eq("id", orderId);
  //   return { paymentUrl: paymentResult.paymentPageLink, orderNumber };

  // adminClient is used for the payment update because there is no orders_own_update
  // RLS policy for regular users (payment confirmation in production comes from a webhook,
  // not from the user session).
  const { error: paymentUpdateError } = await adminClient
    .from("orders")
    .update({
      payment_status:    "paid",
      order_status:      "confirmed",
      payment_method:    "card_mock",
      payment_reference: `MOCK-${Date.now()}`,
    })
    .eq("id", orderId);

  if (paymentUpdateError) {
    // Order was created successfully; log the failure but do not surface it to
    // the user — a real webhook would retry this update independently.
    console.error("[createOrder] mock payment update failed", {
      orderId,
      error: paymentUpdateError.message,
    });
  }

  // ── Transactional emails ───────────────────────────────────────────────────
  // Build the shared payload from data already in scope — no extra DB query needed.
  const emailData: OrderEmailData = {
    orderId,
    orderNumber,
    createdAt: new Date().toISOString(),
    customerName: customerName,
    customerEmail: customerEmail,
    customerPhone: customerPhone,
    addressStreet: addressStreet,
    addressHouseNumber: addressHouseNumber,
    addressApartment: addressApartment,
    addressCity: addressCity,
    deliveryNotes: deliveryNotes,
    items: lineItems.map((item) => {
      const snap = item.snapshot as {
        product_name: string;
        variant_label: string;
        price_agorot: number;
      };
      return {
        productName: snap.product_name,
        variantLabel: snap.variant_label,
        quantity: item.quantity,
        unitPriceAgorot: item.unitPriceAgorot,
        totalPriceAgorot: item.totalPriceAgorot,
      };
    }),
    subtotalAgorot: subtotalAgorot,
    deliveryFeeAgorot: deliveryFeeAgorot,
    totalAgorot: totalAgorot,
    paymentMethod: "card_mock",
    orderStatus: "confirmed",
  };

  // Fire both emails concurrently. Email failure never blocks the order response.
  void Promise.all([
    sendCustomerOrderConfirmation(emailData),
    sendAdminNewOrderNotification(emailData),
  ]).then(([customerResult, adminResult]) => {
    if (!customerResult.ok) {
      console.error("[createOrder] customer confirmation email failed", {
        orderId,
        error: customerResult.error,
      });
    }
    if (!adminResult.ok) {
      console.error("[createOrder] admin notification email failed", {
        orderId,
        error: adminResult.error,
      });
    }
  });

  // Clear the user's DB cart server-side as part of the order completion response.
  // Belt-and-suspenders: client-side clearCart() also fires after this returns.
  await supabase.from("user_cart_items").delete().eq("user_id", user.id);

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return { paymentUrl: `${origin}/checkout/success?order=${orderNumber}`, orderNumber };
}
