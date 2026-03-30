export type { Database, OrderStatus, PaymentStatus, UserRole, VariantUnit } from "./database";

import type { Database } from "./database";

// Convenient row types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Address = Database["public"]["Tables"]["addresses"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductVariant = Database["public"]["Tables"]["product_variants"]["Row"];
export type DeliveryZone = Database["public"]["Tables"]["delivery_zones"]["Row"];
export type Settlement = Database["public"]["Tables"]["settlements"]["Row"];
export type Cart = Database["public"]["Tables"]["carts"]["Row"];
export type CartItem = Database["public"]["Tables"]["cart_items"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

// Enriched / joined types
export type ProductWithVariants = Product & {
  variants: ProductVariant[];
  category: Category;
};

export type CartItemEnriched = CartItem & {
  variant: ProductVariant & {
    product: Product;
  };
};

export type CartWithItems = Cart & {
  items: CartItemEnriched[];
  delivery_zone: DeliveryZone | null;
};

export type OrderWithItems = Order & {
  items: OrderItem[];
  delivery_zone: DeliveryZone;
};

// UI helpers
export interface CartSummary {
  itemCount: number;
  subtotalAgorot: number;
  deliveryFeeAgorot: number;
  totalAgorot: number;
  isFreeDelivery: boolean;
  remainingForFreeDeliveryAgorot: number | null;
}
