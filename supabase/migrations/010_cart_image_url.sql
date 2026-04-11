-- Add image_url column to user_cart_items so the actual product photo
-- can be stored and displayed in the cart drawer, cart page, and checkout summary.
-- Previously only image_color (gradient background) and product_icon (emoji) were stored,
-- so products with real photos showed only an emoji in the cart.

ALTER TABLE user_cart_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;
