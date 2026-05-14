"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { createCardComSession } from "@/lib/cardcom";

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
    // pending_payment duplicate: create a new CardCom session below (old one may have expired).
  }

  // ── Initiate CardCom payment session ───────────────────────────────────────
  // All CardCom API calls are server-side only. Credentials never reach the client.
  let cardComSession: Awaited<ReturnType<typeof createCardComSession>>;
  try {
    cardComSession = await createCardComSession({
      orderId,
      orderNumber,
      totalAgorot,
      customerName,
      customerEmail,
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

  // Clear the DB cart — the order is the source of truth from here on.
  await supabase.from("user_cart_items").delete().eq("user_id", user.id);

  // Confirmation emails are sent by the CardCom webhook at /api/cardcom/callback
  // once payment is verified server-side.
  return { paymentUrl: cardComSession.paymentUrl, orderNumber };
}
