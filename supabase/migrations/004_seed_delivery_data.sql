-- ============================================================
-- משק 22 – Seed Delivery Zones & Settlements
-- Migration: 004_seed_delivery_data.sql
-- ============================================================
-- Seeds the 6 delivery zones and all settlements that the
-- checkout code (src/lib/delivery.ts + src/lib/data/settlements.ts)
-- expects to find in the database.
--
-- Idempotent: uses ON CONFLICT DO UPDATE so re-running is safe.
-- Settlements are upserted by name; zones by slug.
-- ============================================================

-- ── 1. Delivery zones ─────────────────────────────────────────────────────────

INSERT INTO delivery_zones (
  name,
  slug,
  description,
  delivery_fee_agorot,
  min_order_agorot,
  free_delivery_threshold_agorot,
  delivery_days,
  estimated_delivery_hours,
  is_active,
  sort_order
) VALUES
  ('גוש דן מרכזי',      'zone-center',    'תל אביב-יפו, רמת גן, גבעתיים, בני ברק ועוד', 0,    5000,  15000, ARRAY['ראשון','שני','שלישי','רביעי','חמישי'], 24,  true, 10),
  ('גוש דן רחב',        'zone-gush-dan',  'פתח תקווה, חולון, בת ים, ראשון לציון ועוד',   1500, 7500,  20000, ARRAY['ראשון','שני','שלישי','רביעי','חמישי'], 24,  true, 20),
  ('מרכז הארץ',         'zone-central',   'נתניה, חדרה, מודיעין, אשקלון ועוד',           2500, 10000, 25000, ARRAY['ראשון','שני','שלישי','רביעי','חמישי'], 48,  true, 30),
  ('ירושלים והסביבה',   'zone-jerusalem', 'ירושלים, מעלה אדומים, בית שמש ועוד',          3500, 10000, 30000, ARRAY['ראשון','שני','שלישי','רביעי','חמישי'], 48,  true, 40),
  ('צפון',              'zone-north',     'חיפה, נצרת, טבריה, נהריה ועוד',               3500, 10000, 30000, ARRAY['ראשון','שני','שלישי','רביעי','חמישי'], 72,  true, 50),
  ('דרום',              'zone-south',     'באר שבע, אשדוד (דרום), אילת ועוד',             4500, 15000, NULL,  ARRAY['ראשון','שני','שלישי','רביעי','חמישי'], 96,  true, 60)
ON CONFLICT (slug) DO UPDATE SET
  name                            = EXCLUDED.name,
  description                     = EXCLUDED.description,
  delivery_fee_agorot             = EXCLUDED.delivery_fee_agorot,
  min_order_agorot                = EXCLUDED.min_order_agorot,
  free_delivery_threshold_agorot  = EXCLUDED.free_delivery_threshold_agorot,
  delivery_days                   = EXCLUDED.delivery_days,
  estimated_delivery_hours        = EXCLUDED.estimated_delivery_hours,
  is_active                       = EXCLUDED.is_active,
  sort_order                      = EXCLUDED.sort_order,
  updated_at                      = now();

-- ── 2. Settlements ────────────────────────────────────────────────────────────
-- Each settlement is linked to its zone by looking up the zone UUID via slug.
-- ON CONFLICT (name) ensures re-running is safe.

INSERT INTO settlements (name, delivery_zone_id, is_active)
SELECT s.name, dz.id, true
FROM (VALUES
  -- גוש דן מרכזי
  ('תל אביב-יפו',             'zone-center'),
  ('רמת גן',                  'zone-center'),
  ('גבעתיים',                 'zone-center'),
  ('בני ברק',                 'zone-center'),
  ('אור יהודה',               'zone-center'),
  ('גבעת שמואל',              'zone-center'),
  ('קריית אונו',              'zone-center'),
  ('אזור',                    'zone-center'),
  ('יהוד-מונוסון',            'zone-center'),
  -- גוש דן רחב
  ('פתח תקווה',               'zone-gush-dan'),
  ('חולון',                   'zone-gush-dan'),
  ('בת ים',                   'zone-gush-dan'),
  ('ראשון לציון',             'zone-gush-dan'),
  ('רחובות',                  'zone-gush-dan'),
  ('לוד',                     'zone-gush-dan'),
  ('רמלה',                    'zone-gush-dan'),
  ('נס ציונה',                'zone-gush-dan'),
  ('אשדוד',                   'zone-gush-dan'),
  ('גדרה',                    'zone-gush-dan'),
  ('יבנה',                    'zone-gush-dan'),
  ('מזכרת בתיה',              'zone-gush-dan'),
  ('רמת השרון',               'zone-gush-dan'),
  ('הרצליה',                  'zone-gush-dan'),
  ('רעננה',                   'zone-gush-dan'),
  ('כפר סבא',                 'zone-gush-dan'),
  ('הוד השרון',               'zone-gush-dan'),
  ('אלעד',                    'zone-gush-dan'),
  ('ראש העין',                'zone-gush-dan'),
  ('מודיעין עילית',           'zone-gush-dan'),
  -- מרכז הארץ
  ('נתניה',                   'zone-central'),
  ('חדרה',                    'zone-central'),
  ('זכרון יעקב',              'zone-central'),
  ('מודיעין-מכבים-רעות',      'zone-central'),
  ('בית שמש',                 'zone-central'),
  ('קרית מלאכי',              'zone-central'),
  ('אשקלון',                  'zone-central'),
  ('רישון לציון (מזרח)',      'zone-central'),
  ('טירת כרמל',               'zone-central'),
  ('פרדס חנה-כרכור',          'zone-central'),
  ('עמנואל',                  'zone-central'),
  ('ארד',                     'zone-central'),
  ('קלנסווה',                 'zone-central'),
  ('טייבה',                   'zone-central'),
  ('טול כרם',                 'zone-central'),
  -- ירושלים והסביבה
  ('ירושלים',                 'zone-jerusalem'),
  ('מעלה אדומים',             'zone-jerusalem'),
  ('בית אל',                  'zone-jerusalem'),
  ('גבעת זאב',                'zone-jerusalem'),
  ('ביתר עילית',              'zone-jerusalem'),
  ('אפרת',                    'zone-jerusalem'),
  ('אבו גוש',                 'zone-jerusalem'),
  ('קרית ארבע',               'zone-jerusalem'),
  ('בית לחם הגלילית',         'zone-jerusalem'),
  -- צפון
  ('חיפה',                    'zone-north'),
  ('קריות (קרית ביאליק)',      'zone-north'),
  ('קרית ים',                 'zone-north'),
  ('קרית מוצקין',             'zone-north'),
  ('קרית אתא',                'zone-north'),
  ('עכו',                     'zone-north'),
  ('נהריה',                   'zone-north'),
  ('נצרת',                    'zone-north'),
  ('נצרת עילית (נוף הגליל)',  'zone-north'),
  ('עפולה',                   'zone-north'),
  ('כרמיאל',                  'zone-north'),
  ('טבריה',                   'zone-north'),
  ('צפת',                     'zone-north'),
  ('כפר כנא',                 'zone-north'),
  ('מגדל העמק',               'zone-north'),
  ('בית שאן',                 'zone-north'),
  ('שפרעם',                   'zone-north'),
  -- דרום
  ('באר שבע',                 'zone-south'),
  ('אילת',                    'zone-south'),
  ('דימונה',                  'zone-south'),
  ('נתיבות',                  'zone-south'),
  ('שדרות',                   'zone-south'),
  ('אופקים',                  'zone-south'),
  ('ירוחם',                   'zone-south'),
  ('מצפה רמון',               'zone-south'),
  ('רהט',                     'zone-south')
) AS s(name, zone_slug)
JOIN delivery_zones dz ON dz.slug = s.zone_slug
ON CONFLICT (name) DO UPDATE SET
  delivery_zone_id = EXCLUDED.delivery_zone_id,
  is_active        = true;

-- ── 3. Public read policies ───────────────────────────────────────────────────
-- Allow authenticated (and anonymous) users to read active delivery zones and
-- settlements. Required for checkout zone resolution on the server.

DROP POLICY IF EXISTS "delivery_zones_public_read" ON public.delivery_zones;
CREATE POLICY "delivery_zones_public_read" ON public.delivery_zones
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "settlements_public_read" ON public.settlements;
CREATE POLICY "settlements_public_read" ON public.settlements
  FOR SELECT USING (is_active = true);
