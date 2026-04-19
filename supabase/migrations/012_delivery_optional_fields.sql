-- Make min_order_agorot nullable so delivery zones can have no minimum order.
-- The previous DEFAULT 0 was a fake "no minimum" sentinel; NULL is the correct value.

ALTER TABLE delivery_zones
  ALTER COLUMN min_order_agorot DROP NOT NULL,
  ALTER COLUMN min_order_agorot DROP DEFAULT;

-- Convert existing 0 values (fake "no minimum" placeholders) to NULL.
UPDATE delivery_zones SET min_order_agorot = NULL WHERE min_order_agorot = 0;
