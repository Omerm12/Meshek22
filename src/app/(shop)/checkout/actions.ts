"use server";

import { createClient } from "@/lib/supabase/server";
import { getDeliveryQuote, DELIVERY_ZONES } from "@/lib/delivery";
import { createPaymentPage } from "@/lib/payment/payplus";
import type { Database, Json } from "@/types/database";

type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type OrderItemInsert = Database["public"]["Tables"]["order_items"]["Insert"];

interface CartItemInput {
  variantId: string;
  quantity: number;
  productName: string;
  variantLabel: string;
}

type CreateOrderResult = { error: string } | { paymentUrl: string; orderNumber: string };

/**
 * Create an order from checkout form data.
 *
 * Security: all totals and prices are calculated server-side from the database.
 * Client-supplied prices are never trusted.
 */
export async function createOrder(formData: FormData): Promise<CreateOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // ── Delivery zone ──────────────────────────────────────────────────────────
  const deliveryZoneSlug = (formData.get("delivery_zone_id") as string | null)?.trim();
  if (!deliveryZoneSlug) return { error: "נא לבחור עיר שמשרתת את אזור המשלוח" };

  const zoneData = DELIVERY_ZONES[deliveryZoneSlug];
  if (!zoneData) return { error: "אזור משלוח לא תקין" };

  // ── Customer details ───────────────────────────────────────────────────────
  const customerName = (formData.get("customer_name") as string | null)?.trim() ?? "";
  const customerPhone = (formData.get("customer_phone") as string | null)?.trim() ?? "";
  const customerEmail = (formData.get("customer_email") as string | null)?.trim() ?? "";
  const deliveryNotes = (formData.get("delivery_notes") as string | null)?.trim() || null;

  if (customerName.length < 2) return { error: "נא להזין שם מלא" };
  if (!/^0\d{8,9}$/.test(customerPhone)) return { error: "מספר טלפון לא תקין (לדוגמה: 0501234567)" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return { error: "כתובת אימייל לא תקינה" };

  // ── Address fields ─────────────────────────────────────────────────────────
  const addressStreet = (formData.get("address_street") as string | null)?.trim() ?? "";
  const addressHouseNumber = (formData.get("address_house_number") as string | null)?.trim() ?? "";
  const addressCity = (formData.get("address_city") as string | null)?.trim() ?? "";
  const addressApartment = (formData.get("address_apartment") as string | null)?.trim() || null;

  if (!addressStreet) return { error: "נא להזין שם רחוב" };
  if (!addressHouseNumber) return { error: "נא להזין מספר בית" };
  if (!addressCity) return { error: "נא להזין עיר" };

  // ── Server-side price validation ──────────────────────────────────────────
  // Fetch real variant prices from DB — never trust client-side prices
  const variantIds = cartItems.map((i) => i.variantId);

  const { data: variants, error: variantError } = await supabase
    .from("product_variants")
    .select("id, price_agorot, is_available, label, products(id, name)")
    .in("id", variantIds);

  if (variantError || !variants) {
    return { error: "שגיאה באימות המוצרים. נא לנסות שוב." };
  }

  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // Build validated order items
  type OrderItemData = {
    variantId: string;
    quantity: number;
    unitPriceAgorot: number;
    totalPriceAgorot: number;
    productName: string;
    variantLabel: string;
    snapshot: Json;
  };

  const orderItemsData: OrderItemData[] = [];

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

    const unitPriceAgorot = variant.price_agorot;
    const totalPriceAgorot = unitPriceAgorot * cartItem.quantity;

    // Product name from DB join (with cast since Supabase types nested joins loosely)
    const product = (variant.products as unknown as { id: string; name: string } | null);
    const productName = product?.name ?? cartItem.productName;

    const snapshot: Json = {
      product_name: productName,
      variant_label: variant.label,
      price_agorot: unitPriceAgorot,
    };

    orderItemsData.push({
      variantId: cartItem.variantId,
      quantity: cartItem.quantity,
      unitPriceAgorot,
      totalPriceAgorot,
      productName,
      variantLabel: variant.label,
      snapshot,
    });
  }

  // ── Server-side totals ─────────────────────────────────────────────────────
  const subtotalAgorot = orderItemsData.reduce((s, i) => s + i.totalPriceAgorot, 0);
  const quote = getDeliveryQuote(deliveryZoneSlug, subtotalAgorot);

  // Enforce minimum order server-side
  if (!quote.meetsMinimum) {
    const minFmt = `${(quote.zone.minOrderAgorot / 100).toLocaleString("he-IL")} ₪`;
    return {
      error: `ההזמנה המינימלית לאזור ${quote.zone.name} היא ${minFmt}. חסרים עוד ${(quote.shortfallAgorot / 100).toLocaleString("he-IL")} ₪.`,
    };
  }

  const deliveryFeeAgorot = quote.feeAgorot;
  const discountAgorot = 0;
  const totalAgorot = subtotalAgorot + deliveryFeeAgorot - discountAgorot;

  // ── Resolve delivery zone UUID ─────────────────────────────────────────────
  // orders.delivery_zone_id is a FK to delivery_zones.id (UUID)
  const { data: zoneRow, error: zoneError } = await supabase
    .from("delivery_zones")
    .select("id")
    .eq("slug", deliveryZoneSlug)
    .single();

  if (zoneError || !zoneRow) {
    return {
      error: "אזור המשלוח לא נמצא במערכת. נא לפנות לתמיכה.",
    };
  }

  // ── Create order record ────────────────────────────────────────────────────
  const deliveryAddressSnapshot: Json = {
    street: addressStreet,
    house_number: addressHouseNumber,
    apartment: addressApartment,
    city: addressCity,
    zone_name: zoneData.name,
    zone_slug: deliveryZoneSlug,
  };

  const customerSnapshot: Json = {
    name: customerName,
    phone: customerPhone,
    email: customerEmail,
  };

  const orderInsert: OrderInsert = {
    user_id: user?.id ?? null,
    delivery_zone_id: zoneRow.id,
    delivery_address_snapshot: deliveryAddressSnapshot,
    customer_snapshot: customerSnapshot,
    subtotal_agorot: subtotalAgorot,
    delivery_fee_agorot: deliveryFeeAgorot,
    discount_agorot: discountAgorot,
    total_agorot: totalAgorot,
    order_status: "pending_payment",
    payment_status: "pending",
    delivery_notes: deliveryNotes,
  };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert(orderInsert)
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    console.error("Order insert error:", orderError);
    return { error: "שגיאה ביצירת ההזמנה. נא לנסות שוב." };
  }

  // ── Create order items ─────────────────────────────────────────────────────
  const orderItemsInsert: OrderItemInsert[] = orderItemsData.map((item) => ({
    order_id: order.id,
    product_variant_id: item.variantId,
    product_snapshot: item.snapshot,
    quantity: item.quantity,
    unit_price_agorot: item.unitPriceAgorot,
    total_price_agorot: item.totalPriceAgorot,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItemsInsert);

  if (itemsError) {
    console.error("Order items insert error:", itemsError);
    // Attempt rollback
    await supabase.from("orders").delete().eq("id", order.id);
    return { error: "שגיאה בשמירת פריטי ההזמנה. נא לנסות שוב." };
  }

  // ── Initiate payment ───────────────────────────────────────────────────────
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Development / missing credentials: simulate payment directly
  if (!process.env.PAYPLUS_API_KEY) {
    await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        order_status: "paid",
        payment_method: "dev_bypass",
        payment_reference: `DEV-${Date.now()}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return {
      paymentUrl: `${origin}/checkout/success?order=${order.order_number}`,
      orderNumber: order.order_number,
    };
  }

  // Production: create PayPlus payment page
  try {
    const paymentResult = await createPaymentPage({
      orderId: order.id,
      orderNumber: order.order_number,
      amountNIS: totalAgorot / 100,
      customerEmail,
      customerName,
      customerPhone,
      items: orderItemsData.map((item) => ({
        name: `${item.productName} – ${item.variantLabel}`,
        quantity: item.quantity,
        price: item.unitPriceAgorot / 100,
      })),
      successUrl: `${origin}/checkout/success?order=${order.order_number}`,
      failureUrl: `${origin}/checkout/failure?order=${order.order_number}`,
      cancelUrl: `${origin}/checkout?canceled=1`,
      webhookUrl: `${origin}/api/payment/webhook`,
    });

    // Persist payment page reference
    await supabase
      .from("orders")
      .update({
        payment_reference: paymentResult.paypageUid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return {
      paymentUrl: paymentResult.paymentPageLink,
      orderNumber: order.order_number,
    };
  } catch (e) {
    console.error("PayPlus createPaymentPage error:", e);
    // Order is created but payment initiation failed.
    // The order stays as pending_payment — customer can retry.
    return {
      error: "שגיאה ביצירת דף התשלום. ההזמנה נשמרה במערכת. נא לפנות לתמיכה בטלפון *3722.",
    };
  }
}
