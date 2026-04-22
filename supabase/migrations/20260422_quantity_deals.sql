-- ─── Quantity deal columns on products ──────────────────────────────────────
-- qty_deal_enabled:      whether the bundle deal is active
-- qty_deal_quantity:     how many units to buy to trigger the deal (e.g. 4)
-- qty_deal_price_agorot: total price for that bundle in agorot (e.g. 1000 = ₪10)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS qty_deal_enabled      BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qty_deal_quantity     INTEGER  CHECK (qty_deal_quantity > 0),
  ADD COLUMN IF NOT EXISTS qty_deal_price_agorot INTEGER  CHECK (qty_deal_price_agorot > 0);

-- ─── Quantity deal columns on user_cart_items ────────────────────────────────
-- Denormalized from the product at add-to-cart time so the cart display and
-- subtotal can show the deal price without re-fetching product data.

ALTER TABLE user_cart_items
  ADD COLUMN IF NOT EXISTS deal_enabled      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_quantity     INTEGER,
  ADD COLUMN IF NOT EXISTS deal_price_agorot INTEGER;
