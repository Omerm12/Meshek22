export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderStatus =
  | "pending_payment"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type UserRole = "customer" | "admin" | "manager";

/** How the customer receives the order. Constrained by orders_fulfillment_method_chk. */
export type FulfillmentMethod = "delivery" | "pickup";

/**
 * Constrained by orders_payment_method_chk (added NOT VALID, so historical rows
 * may still carry legacy values such as "card_mock").
 */
export type OrderPaymentMethod = "credit_card" | "cash" | "phone_credit";

export type PromotionType = "mix_and_match_quantity";

export type VariantUnit =
  | "unit"
  | "500g"
  | "1kg"
  | "bunch"
  | "pack"
  | "2kg"
  | "250g";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          role: UserRole;
          /** Timestamp of the user's last successful login. Set exclusively by the
           *  recordLogin() Server Action (admin client). Used to enforce 14-day expiry. */
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          /**
           * Column-level privilege: REVOKE INSERT, UPDATE ON last_login_at FROM authenticated.
           * Writable ONLY via the recordLogin() Server Action (service_role / admin client).
           * The authenticated role cannot write this column even with a valid session.
           */
          last_login_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          street: string;
          house_number: string;
          apartment: string | null;
          city: string;
          zip_code: string | null;
          notes: string | null;
          is_default: boolean;
          delivery_zone_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          street: string;
          house_number: string;
          apartment?: string | null;
          city: string;
          zip_code?: string | null;
          notes?: string | null;
          is_default?: boolean;
          delivery_zone_id?: string | null;
        };
        Update: {
          label?: string | null;
          street?: string;
          house_number?: string;
          apartment?: string | null;
          city?: string;
          zip_code?: string | null;
          notes?: string | null;
          is_default?: boolean;
          delivery_zone_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          sort_order: number;
          is_active: boolean;
          is_featured: boolean;
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          is_featured?: boolean;
          parent_id?: string | null;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          is_featured?: boolean;
          parent_id?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          is_active: boolean;
          is_featured: boolean;
          sort_order: number;
          /** Bundle deal: buy qty_deal_quantity units for qty_deal_price_agorot total */
          qty_deal_enabled: boolean;
          qty_deal_quantity: number | null;
          qty_deal_price_agorot: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          sort_order?: number;
          qty_deal_enabled?: boolean;
          qty_deal_quantity?: number | null;
          qty_deal_price_agorot?: number | null;
        };
        Update: {
          category_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          sort_order?: number;
          qty_deal_enabled?: boolean;
          qty_deal_quantity?: number | null;
          qty_deal_price_agorot?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          unit: VariantUnit;
          label: string;
          price_agorot: number;
          compare_price_agorot: number | null;
          stock_quantity: number | null;
          /** 'per_kg': total = price_agorot × quantity. 'fixed': total = price_agorot */
          quantity_pricing_mode: 'fixed' | 'per_kg';
          /** Increment/decrement step for fractional quantities (e.g. 0.5 for 500g steps) */
          quantity_step: number;
          /** Minimum purchasable quantity (first add initialises to this value) */
          min_quantity: number;
          is_available: boolean;
          is_default: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          unit: VariantUnit;
          label: string;
          price_agorot: number;
          compare_price_agorot?: number | null;
          stock_quantity?: number | null;
          quantity_pricing_mode?: 'fixed' | 'per_kg';
          quantity_step?: number;
          min_quantity?: number;
          is_available?: boolean;
          is_default?: boolean;
          sort_order?: number;
        };
        Update: {
          unit?: VariantUnit;
          label?: string;
          price_agorot?: number;
          compare_price_agorot?: number | null;
          stock_quantity?: number | null;
          quantity_pricing_mode?: 'fixed' | 'per_kg';
          quantity_step?: number;
          min_quantity?: number;
          is_available?: boolean;
          is_default?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      delivery_zones: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          delivery_fee_agorot: number;
          min_order_agorot: number | null;
          free_delivery_threshold_agorot: number | null;
          delivery_days: string[];
          estimated_delivery_hours: number | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          delivery_fee_agorot: number;
          min_order_agorot?: number | null;
          free_delivery_threshold_agorot?: number | null;
          delivery_days?: string[];
          estimated_delivery_hours?: number | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          delivery_fee_agorot?: number;
          min_order_agorot?: number | null;
          free_delivery_threshold_agorot?: number | null;
          delivery_days?: string[];
          estimated_delivery_hours?: number | null;
          is_active?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      settlements: {
        Row: {
          id: string;
          name: string;
          delivery_zone_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          delivery_zone_id?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          delivery_zone_id?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      carts: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          delivery_zone_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          delivery_zone_id?: string | null;
        };
        Update: {
          user_id?: string | null;
          session_id?: string | null;
          delivery_zone_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_variant_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          product_variant_id: string;
          quantity: number;
        };
        Update: {
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          /** NULL for guest orders — every order placed since customer accounts were removed. */
          user_id: string | null;
          idempotency_key: string | null;
          /** NULL only when fulfillment_method = 'pickup' (DB CHECK constraint). */
          delivery_zone_id: string | null;
          fulfillment_method: FulfillmentMethod;
          delivery_address_snapshot: Json;
          customer_snapshot: Json;
          subtotal_agorot: number;
          delivery_fee_agorot: number;
          discount_agorot: number;
          total_agorot: number;
          /** Snapshot of the promotions applied at purchase time. */
          discount_breakdown: Json | null;
          order_status: OrderStatus;
          payment_status: PaymentStatus;
          payment_method: string | null;
          payment_reference: string | null;
          /** SHA-256 of the guest's order access token. The plaintext is never stored. */
          guest_access_token_hash: string | null;
          delivery_notes: string | null;
          requested_delivery_date: string | null;
          confirmed_delivery_date: string | null;
          customer_email_sent_at: string | null;
          admin_email_sent_at: string | null;
          cardcom_approval_number: string | null;
          payment_metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          idempotency_key?: string | null;
          delivery_zone_id?: string | null;
          fulfillment_method?: FulfillmentMethod;
          delivery_address_snapshot: Json;
          customer_snapshot: Json;
          subtotal_agorot: number;
          delivery_fee_agorot: number;
          discount_agorot?: number;
          total_agorot: number;
          discount_breakdown?: Json | null;
          order_status?: OrderStatus;
          payment_status?: PaymentStatus;
          payment_method?: string | null;
          payment_reference?: string | null;
          guest_access_token_hash?: string | null;
          delivery_notes?: string | null;
          requested_delivery_date?: string | null;
        };
        Update: {
          order_status?: OrderStatus;
          payment_status?: PaymentStatus;
          payment_method?: string | null;
          payment_reference?: string | null;
          guest_access_token_hash?: string | null;
          delivery_notes?: string | null;
          confirmed_delivery_date?: string | null;
          customer_email_sent_at?: string | null;
          admin_email_sent_at?: string | null;
          cardcom_approval_number?: string | null;
          payment_metadata?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_variant_id: string;
          product_snapshot: Json;
          /** NUMERIC(10,4) — supports fractional kg quantities */
          quantity: number;
          unit_price_agorot: number;
          /** Undiscounted line total. Sum of these equals orders.subtotal_agorot. */
          total_price_agorot: number;
          /** Promotion saving on this line. Charged amount = total_price_agorot − discount_agorot. */
          discount_agorot: number;
          /** Promotion that produced the discount. Not a FK: the order outlives the promotion. */
          promotion_id: string | null;
          promotion_snapshot: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_variant_id: string;
          product_snapshot: Json;
          quantity: number;
          unit_price_agorot: number;
          total_price_agorot: number;
          discount_agorot?: number;
          promotion_id?: string | null;
          promotion_snapshot?: Json | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      promotions: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          promotion_type: PromotionType;
          required_quantity: number;
          bundle_price_agorot: number;
          is_active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          promotion_type?: PromotionType;
          required_quantity: number;
          bundle_price_agorot: number;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          sort_order?: number;
        };
        Update: {
          name?: string;
          description?: string | null;
          promotion_type?: PromotionType;
          required_quantity?: number;
          bundle_price_agorot?: number;
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      promotion_items: {
        Row: {
          promotion_id: string;
          product_variant_id: string;
          created_at: string;
        };
        Insert: {
          promotion_id: string;
          product_variant_id: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      admin_login_attempts: {
        Row: {
          id: string;
          /** Salted SHA-256 of an IP or username — never the raw value. */
          identity_hash: string;
          identity_kind: "ip" | "username";
          succeeded: boolean;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          identity_hash: string;
          identity_kind: "ip" | "username";
          succeeded?: boolean;
          attempted_at?: string;
        };
        Update: {
          succeeded?: boolean;
        };
        Relationships: [];
      };
      otp_rate_limits: {
        Row: {
          id: string;
          channel: "sms" | "email";
          identifier: string;
          requested_at: string;
        };
        Insert: {
          id?: string;
          channel: "sms" | "email";
          identifier: string;
          requested_at?: string;
        };
        Update: {
          channel?: "sms" | "email";
          identifier?: string;
          requested_at?: string;
        };
        Relationships: [];
      };
      user_cart_items: {
        Row: {
          id: string;
          user_id: string;
          variant_id: string;
          product_id: string;
          product_name: string;
          variant_label: string;
          price_agorot: number;
          quantity: number;
          quantity_pricing_mode: "fixed" | "per_kg";
          quantity_step: number;
          min_quantity: number;
          deal_enabled: boolean;
          deal_quantity: number | null;
          deal_price_agorot: number | null;
          image_url: string | null;
          image_color: string | null;
          product_icon: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          variant_id: string;
          product_id: string;
          product_name: string;
          variant_label: string;
          price_agorot: number;
          quantity: number;
          quantity_pricing_mode?: "fixed" | "per_kg";
          quantity_step?: number;
          min_quantity?: number;
          deal_enabled?: boolean;
          deal_quantity?: number | null;
          deal_price_agorot?: number | null;
          image_url?: string | null;
          image_color?: string | null;
          product_icon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          product_name?: string;
          variant_label?: string;
          price_agorot?: number;
          quantity?: number;
          quantity_pricing_mode?: "fixed" | "per_kg";
          quantity_step?: number;
          min_quantity?: number;
          deal_enabled?: boolean;
          deal_quantity?: number | null;
          deal_price_agorot?: number | null;
          image_url?: string | null;
          image_color?: string | null;
          product_icon?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_or_create_cart: {
        Args: { p_user_id: string | null; p_session_id: string | null };
        Returns: string;
      };
      generate_order_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      create_order_atomic: {
        Args: {
          p_idempotency_key: string;
          p_delivery_zone_id: string;
          p_delivery_address: Json;
          p_customer: Json;
          p_subtotal_agorot: number;
          p_delivery_fee_agorot: number;
          p_discount_agorot: number;
          p_total_agorot: number;
          p_delivery_notes: string | null;
          p_items: Json;
        };
        Returns: {
          out_order_id: string;
          out_order_number: string;
          out_is_duplicate: boolean;
        }[];
      };
      /**
       * Guest order creation. EXECUTE is granted to service_role only — anon and
       * authenticated cannot call it, so prices can never be supplied by a client.
       */
      create_guest_order_atomic: {
        Args: {
          p_idempotency_key: string;
          p_fulfillment_method: FulfillmentMethod;
          p_delivery_zone_id: string | null;
          p_delivery_address: Json;
          p_customer: Json;
          p_subtotal_agorot: number;
          p_delivery_fee_agorot: number;
          p_discount_agorot: number;
          p_total_agorot: number;
          p_delivery_notes: string | null;
          p_payment_method: OrderPaymentMethod;
          p_order_status: "pending_payment" | "confirmed";
          p_payment_status: "pending" | "paid";
          p_guest_token_hash: string;
          p_discount_breakdown: Json;
          p_items: Json;
        };
        Returns: {
          out_order_id: string;
          out_order_number: string;
          out_is_duplicate: boolean;
        }[];
      };
      /** One-round-trip dashboard counters. service_role only. */
      admin_dashboard_counts: {
        Args: Record<string, never>;
        Returns: Json;
      };
      prune_admin_login_attempts: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: {
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      user_role: UserRole;
      variant_unit: VariantUnit;
      fulfillment_method: FulfillmentMethod;
      promotion_type: PromotionType;
    };
  };
}
