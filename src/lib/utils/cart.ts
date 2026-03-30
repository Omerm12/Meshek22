import type { CartItemEnriched, CartSummary, DeliveryZone } from "@/types";

export function calculateCartSummary(
  items: CartItemEnriched[],
  zone: DeliveryZone | null
): CartSummary {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalAgorot = items.reduce(
    (sum, item) => sum + item.variant.price_agorot * item.quantity,
    0
  );

  let deliveryFeeAgorot = zone?.delivery_fee_agorot ?? 0;
  let isFreeDelivery = false;
  let remainingForFreeDeliveryAgorot: number | null = null;

  if (zone) {
    const threshold = zone.free_delivery_threshold_agorot;
    if (threshold !== null) {
      if (subtotalAgorot >= threshold) {
        isFreeDelivery = true;
        deliveryFeeAgorot = 0;
      } else {
        remainingForFreeDeliveryAgorot = threshold - subtotalAgorot;
      }
    }
  }

  const totalAgorot = subtotalAgorot + deliveryFeeAgorot;

  return {
    itemCount,
    subtotalAgorot,
    deliveryFeeAgorot,
    totalAgorot,
    isFreeDelivery,
    remainingForFreeDeliveryAgorot,
  };
}
