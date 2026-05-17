"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { createCardComSession, type CardComLineItem } from "@/lib/cardcom";

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
 * Create an order from checkout form data and initiate a CardCom payment session.
 *
 * Security model:
 * - Auth is verified server-side via supabase.auth.getUser() (JWT validation).
 * - All prices and totals are re-fetched from the DB — client values are ignored.
 * - Delivery zone is fetched by UUID from the DB — no hardcoded slug mapping.
 * - Minimum order is enforced server-side.
 * - Order + items are inserted atomically via create_order_atomic() Postgres RPC.
 * - Idempotency key (UUID generated per checkout session) prevents duplicate orders
 *   on double-click, network retry, or page refresh during submission.
 * - Payment status is set to paid ONLY by the CardCom server-side webhook at
 *   /api/cardcom/callback — never based on the user's success redirect URL.
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
    .select("id, price_agorot, is_available, label, quantity_pricing_mode, products(id, name, qty_deal_enabled, qty_deal_quantity, qty_deal_price_agorot)")
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
    // Validate quantity: must be positive and finite.
    // Per-kg variants use fractional quantities (e.g. 0.5, 1.5); fixed variants use integers.
    if (
      typeof cartItem.quantity !== "number" ||
      !isFinite(cartItem.quantity) ||
      cartItem.quantity <= 0 ||
      cartItem.quantity > 999
    ) {
      return { error: `כמות לא תקינה עבור "${cartItem.productName}"` };
    }

    const unitPriceAgorot = variant.price_agorot;
    const product = variant.products as unknown as {
      id: string;
      name: string;
      qty_deal_enabled: boolean | null;
      qty_deal_quantity: number | null;
      qty_deal_price_agorot: number | null;
    } | null;

    // Apply bundle deal pricing server-side when the deal is active and qty qualifies.
    let totalPriceAgorot: number;
    const dealEnabled  = product?.qty_deal_enabled  ?? false;
    const dealQuantity = product?.qty_deal_quantity  ?? null;
    const dealPrice    = product?.qty_deal_price_agorot ?? null;
    if (dealEnabled && dealQuantity != null && dealPrice != null && cartItem.quantity >= dealQuantity) {
      const groups    = Math.floor(cartItem.quantity / dealQuantity);
      const remainder = cartItem.quantity % dealQuantity;
      totalPriceAgorot = groups * dealPrice + Math.round(remainder * unitPriceAgorot);
    } else {
      totalPriceAgorot = Math.round(unitPriceAgorot * cartItem.quantity);
    }
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

  if (zoneRow.min_order_agorot !== null && subtotalAgorot < zoneRow.min_order_agorot) {
    const minFmt    = (zoneRow.min_order_agorot / 100).toLocaleString("he-IL");
    const shortfall = zoneRow.min_order_agorot - subtotalAgorot;
    const shortFmt  = (shortfall / 100).toLocaleString("he-IL");
    return {
      error: `ההזמנה המינימלית ל${addressCity} היא ₪${minFmt}. חסרים עוד ₪${shortFmt}.`,
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

  // ── Idempotent duplicate: if already paid return success directly ──────────
  if (isDuplicate) {
    const { data: existingOrder } = await adminClient
      .from("orders")
      .select("payment_status")
      .eq("id", orderId)
      .single();

    if (existingOrder?.payment_status === "paid") {
      await supabase.from("user_cart_items").delete().eq("user_id", user.id);
      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      return { paymentUrl: `${origin}/checkout/success?order=${orderNumber}`, orderNumber };
    }

    // If a previous attempt set the order to "failed", reset to "pending" before
    // creating a new Cardcom session so the success webhook can apply its CAS update.
    if (existingOrder?.payment_status === "failed") {
      await adminClient
        .from("orders")
        .update({ payment_status: "pending", updated_at: new Date().toISOString() })
        .eq("id", orderId);
    }
    // Fall through to create a fresh Cardcom session (previous one may have expired).
  }

  // ── Initiate CardCom payment session ───────────────────────────────────────
  // All CardCom API calls are server-side only. Credentials never reach the client.
  const cardComLineItems: CardComLineItem[] = lineItems.map((item) => {
    const snap = item.snapshot as { product_name: string; variant_label: string };
    return {
      productId:        item.variantId,
      description:      `${snap.product_name} — ${snap.variant_label}`,
      quantity:         item.quantity,
      unitPriceAgorot:  item.unitPriceAgorot,
      totalPriceAgorot: item.totalPriceAgorot,
    };
  });

  let cardComSession: Awaited<ReturnType<typeof createCardComSession>>;
  try {
    cardComSession = await createCardComSession({
      orderId,
      orderNumber,
      totalAgorot,
      customerName,
      customerEmail,
      customerPhone,
      lineItems:        cardComLineItems,
      deliveryFeeAgorot,
    });
  } catch (e) {
    console.error("[createOrder] CardCom session creation failed", e);
    return { error: "שגיאה בתחילת תהליך התשלום. נא לנסות שוב או לפנות לתמיכה." };
  }

  // Store the CardCom LowProfileId so the webhook can correlate the callback.
  // adminClient is used because there is no orders_own_update RLS policy.
  await adminClient
    .from("orders")
    .update({ payment_reference: cardComSession.lowProfileId })
    .eq("id", orderId);

  // Cart is NOT cleared here. It is cleared by the webhook after GetLpResult
  // confirms payment — so the cart is preserved if the user goes back or payment fails.

  // Confirmation emails are sent by the CardCom webhook at /api/cardcom/callback
  // once payment is verified server-side via GetLpResult.
  return { paymentUrl: cardComSession.paymentUrl, orderNumber };
}

/**
 * Creates a new Cardcom payment session for an existing pending/failed order.
 *
 * Called from the payment-error page "נסה שוב" button. Skips the checkout form
 * entirely — uses the line items and customer details already stored on the order.
 *
 * Security:
 * - Auth is verified server-side.
 * - Order is fetched by orderId AND user_id so a user can only retry their own order.
 * - Only pending or failed orders can be retried.
 * - payment_status is reset to "pending" before creating the session so the
 *   new webhook's CAS update can succeed.
 * - payment_reference is updated to the new LowProfileId so the old session's
 *   webhook (if it ever arrives) is blocked by the LowProfileId mismatch check.
 */
export async function retryPayment(orderId: string): Promise<CreateOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "יש להתחבר לחשבון לפני ביצוע תשלום" };
  }

  const adminClient = createAdminClient();

  // Fetch order — eq on user_id ensures the user can only retry their own order.
  const { data: order } = await adminClient
    .from("orders")
    .select(
      "id, order_number, user_id, payment_status, total_agorot, delivery_fee_agorot, customer_snapshot, delivery_notes"
    )
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (!order) {
    console.warn("[retryPayment]", { event: "order_not_found", orderId, userId: user.id });
    return { error: "ההזמנה לא נמצאה" };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Already paid — send directly to success page.
  if (order.payment_status === "paid") {
    console.log("[retryPayment]", { event: "already_paid", orderId });
    return {
      paymentUrl: `${origin}/checkout/success?order=${order.order_number}`,
      orderNumber: order.order_number,
    };
  }

  // Only pending or failed orders are retryable.
  if (order.payment_status !== "pending" && order.payment_status !== "failed") {
    console.warn("[retryPayment]", { event: "not_retryable", orderId, status: order.payment_status });
    return { error: "לא ניתן לנסות שוב הזמנה זו" };
  }

  console.log("[retryPayment]", {
    event: "retry_start",
    orderId,
    userId: user.id,
    currentStatus: order.payment_status,
  });

  // Fetch order items — rebuilt into Cardcom line items using the stored snapshots.
  const { data: orderItems } = await adminClient
    .from("order_items")
    .select("product_variant_id, product_snapshot, quantity, unit_price_agorot, total_price_agorot")
    .eq("order_id", orderId);

  if (!orderItems || orderItems.length === 0) {
    console.error("[retryPayment]", { event: "no_order_items", orderId });
    return { error: "פרטי הזמנה לא נמצאו" };
  }

  const customer = order.customer_snapshot as {
    name?: string;
    email?: string;
    phone?: string;
  } | null;

  type ItemSnap = { product_name: string; variant_label: string };
  const lineItems: CardComLineItem[] = orderItems.map((item) => {
    const snap = item.product_snapshot as unknown as ItemSnap;
    return {
      productId:        item.product_variant_id,
      description:      `${snap.product_name} — ${snap.variant_label}`,
      quantity:         item.quantity,
      unitPriceAgorot:  item.unit_price_agorot,
      totalPriceAgorot: item.total_price_agorot,
    };
  });

  // Reset to pending so the new webhook's CAS (.in(["pending","failed"])) always wins.
  if (order.payment_status === "failed") {
    await adminClient
      .from("orders")
      .update({ payment_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", orderId);
  }

  let cardComSession: Awaited<ReturnType<typeof createCardComSession>>;
  try {
    cardComSession = await createCardComSession({
      orderId:          order.id,
      orderNumber:      order.order_number,
      totalAgorot:      order.total_agorot,
      customerName:     customer?.name  ?? "",
      customerEmail:    customer?.email ?? "",
      customerPhone:    customer?.phone ?? "",
      lineItems,
      deliveryFeeAgorot: order.delivery_fee_agorot,
    });
  } catch (e) {
    console.error("[retryPayment]", { event: "cardcom_session_failed", orderId, error: e });
    // Revert to failed so the order isn't stuck in an orphaned pending state.
    await adminClient
      .from("orders")
      .update({ payment_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("payment_status", "pending");
    return { error: "שגיאה בתחילת תהליך התשלום. נא לנסות שוב." };
  }

  // Update payment_reference to the new LowProfileId.
  // The old session's webhook (if delayed) will be blocked because
  // its LowProfileId no longer matches order.payment_reference.
  await adminClient
    .from("orders")
    .update({ payment_reference: cardComSession.lowProfileId })
    .eq("id", orderId);

  console.log("[retryPayment]", {
    event: "new_session_created",
    orderId,
    userId:         user.id,
    orderNumber:    order.order_number,
    newLowProfileId: cardComSession.lowProfileId,
    redirectTarget: cardComSession.paymentUrl,
  });

  return { paymentUrl: cardComSession.paymentUrl, orderNumber: order.order_number };
}

/**
 * Returns the payment_status of an order by order_number.
 * Used by the success page to poll for payment confirmation after redirect.
 */
export async function getOrderPaymentStatus(orderNumber: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("order_number", orderNumber)
    .maybeSingle();
  return data?.payment_status ?? null;
}
