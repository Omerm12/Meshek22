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
      /**
       * Flat, user-scoped cart table for authenticated users.
       * variant_id and product_id are UUID FKs to product_variants and products
       * respectively (ON DELETE CASCADE — removing a product/variant clears stale
       * cart items automatically). UNIQUE (user_id, variant_id) enables UPSERT.
       */
      user_cart_items: {
        Row: {
          id: string;          // UUID PK
          user_id: string;     // UUID → auth.users(id)
          variant_id: string;  // UUID → product_variants(id)
          product_id: string;  // UUID → products(id)
          product_name: string;
          variant_label: string;
          price_agorot: number;
          quantity: number;
          image_url: string | null;
          image_color: string | null;
          product_icon: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;     // UUID
          variant_id: string;  // UUID
          product_id: string;  // UUID
          product_name: string;
          variant_label: string;
          price_agorot: number;
          quantity: number;
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
          image_url?: string | null;
          image_color?: string | null;
          product_icon?: string | null;
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
          min_order_agorot: number;
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
          min_order_agorot: number;
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
          min_order_agorot?: number;
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
          user_id: string | null;
          idempotency_key: string | null;
          delivery_zone_id: string;
          delivery_address_snapshot: Json;
          customer_snapshot: Json;
          subtotal_agorot: number;
          delivery_fee_agorot: number;
          discount_agorot: number;
          total_agorot: number;
          order_status: OrderStatus;
          payment_status: PaymentStatus;
          payment_method: string | null;
          payment_reference: string | null;
          delivery_notes: string | null;
          requested_delivery_date: string | null;
          confirmed_delivery_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          idempotency_key?: string | null;
          delivery_zone_id: string;
          delivery_address_snapshot: Json;
          customer_snapshot: Json;
          subtotal_agorot: number;
          delivery_fee_agorot: number;
          discount_agorot?: number;
          total_agorot: number;
          order_status?: OrderStatus;
          payment_status?: PaymentStatus;
          payment_method?: string | null;
          payment_reference?: string | null;
          delivery_notes?: string | null;
          requested_delivery_date?: string | null;
        };
        Update: {
          order_status?: OrderStatus;
          payment_status?: PaymentStatus;
          payment_method?: string | null;
          payment_reference?: string | null;
          delivery_notes?: string | null;
          confirmed_delivery_date?: string | null;
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
          quantity: number;
          unit_price_agorot: number;
          total_price_agorot: number;
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
        };
        Update: Record<string, never>;
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
    };
    Enums: {
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      user_role: UserRole;
      variant_unit: VariantUnit;
    };
  };
}
