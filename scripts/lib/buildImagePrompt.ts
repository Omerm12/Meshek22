/**
 * Image prompt builder for Meshek 22 — sourced from data/products.full.json.
 *
 * ProductEntry mirrors the Supabase products table row.
 * Prompts target gpt-image-1. Background removal runs in post-processing,
 * so the prompt focuses on produce quality, composition, and no water drops.
 */

// ─── Type ─────────────────────────────────────────────────────────────────────

export interface ProductEntry {
  id:          string;
  name:        string;         // Hebrew product name
  slug:        string;         // English slug — used for filenames and storage path
  image_url?:  string | null;
  description?: string | null;
  is_active?:  boolean;
  category_id?: string;
  // Optional: override the entire generated prompt for special cases
  promptOverride?: string;
}

// ─── English subject for the prompt ──────────────────────────────────────────
// Keys: slug. Value: plain English description of what to photograph.
// Missing slugs fall back to slug-to-words conversion (hyphens → spaces).

const SLUG_SUBJECT: Record<string, string> = {
  "tamar-tomatoes":             "Tamar plum tomatoes",
  "cluster-tomatoes":           "cluster vine tomatoes",
  "maggie-tomatoes":            "Maggie tomatoes (small ridged variety)",
  "mixed-cherry-tomatoes":      "mixed cherry tomatoes in red, yellow, and orange",
  "hot-pepper":                 "hot chili peppers",
  "red-pepper":                 "red bell peppers",
  "green-pepper":               "green bell peppers",
  "yellow-pepper":              "yellow bell peppers",
  "orange-pepper":              "orange bell peppers",
  "chili-mix":                  "mixed colored chili peppers",
  "artichoke":                  "fresh artichokes",
  "cauliflower":                "fresh cauliflower",
  "greenhouse-eggplant":        "greenhouse eggplant",
  "baladi-eggplant":            "Baladi round eggplant",
  "zucchini":                   "fresh zucchini",
  "leek":                       "fresh leeks",
  "broad-beans":                "fresh broad beans",
  "white-onion":                "white onions",
  "red-onion":                  "red onions",
  "packed-garlic":              "fresh garlic bulb",
  "beetroot":                   "fresh beetroot",
  "turnip":                     "fresh turnips",
  "kohlrabi":                   "fresh kohlrabi",
  "radish-bunch":               "fresh radish bunch",
  "ginger":                     "fresh ginger root",
  "white-cabbage":              "fresh white cabbage",
  "red-cabbage":                "fresh red cabbage",
  "white-cabbage-haslat":       "pre-cut white cabbage",
  "red-cabbage-haslat":         "pre-cut red cabbage",
  "parsley-pack":               "fresh flat-leaf parsley",
  "parsley":                    "fresh flat-leaf parsley",
  "cilantro":                   "fresh coriander",
  "dill":                       "fresh dill",
  "mint":                       "fresh mint",
  "lemon-verbena":              "fresh lemon verbena",
  "rosemary":                   "fresh rosemary",
  "thyme":                      "fresh thyme",
  "oregano":                    "fresh oregano",
  "fennel":                     "fresh fennel bulb",
  "spaghetti-squash":           "spaghetti squash",
  "japanese-pumpkin":           "Japanese pumpkin (kabocha)",
  "arabic-lettuce":             "Arabic lettuce",
  "salanova":                   "Salanova lettuce",
  "lettuce":                    "fresh green lettuce",
  "beet-leaves":                "fresh beet leaves",
  "celery":                     "fresh celery",
  "green-onion":                "fresh green onions",
  "cucumber":                   "fresh cucumbers",
  "broccoli":                   "fresh broccoli",
  "sweet-potato":               "fresh sweet potatoes",
  "carrot":                     "fresh carrots",
  "mushrooms-pack":             "fresh button mushrooms",
  "strawberry-box-haslat":      "fresh strawberries",
  "pomelit":                    "pomelit (Israeli citrus fruit)",
  "red-grapefruit":             "red grapefruits",
  "orange":                     "fresh oranges",
  "lemon":                      "fresh lemons",
  "clementine":                 "fresh clementines",
  "pomelo":                     "fresh pomelos",
  "watermelon":                 "fresh watermelon",
  "melon":                      "fresh melon",
  "kiwi":                       "fresh kiwi fruit",
  "pear":                       "fresh pears",
  "chestnuts":                  "fresh chestnuts",
  "loquat":                     "fresh loquats",
  "israeli-pineapple":          "Israeli pineapple",
  "imported-large-pineapple":   "large fresh pineapple",
  "blueberries":                "fresh blueberries",
  "banana":                     "fresh bananas",
  "avocado":                    "fresh Hass avocado",
  "premium-white-grapes":       "premium white grapes",
  "premium-black-grapes":       "premium dark grapes",
  "premium-red-grapes":         "premium red grapes",
  "strawberry":                 "fresh strawberries",
  "white-potatoes":             "white potatoes",
  "red-potatoes":               "red potatoes",
  "red-apple":                  "fresh red apples",
  "green-apple":                "fresh green apples",
  "golden-apple":               "fresh golden yellow apples",
};

// ─── Composition per slug ─────────────────────────────────────────────────────
// Describes how to arrange the produce in the frame.
// Derived from real Israeli grocery catalog photography (noyhasade.co.il).

const SLUG_COMPOSITION: Record<string, string> = {
  // ── Tomatoes ───────────────────────────────────────────────────────────────
  "tamar-tomatoes":           "3 Tamar (plum-shaped) tomatoes in a tight triangular cluster, touching",
  "cluster-tomatoes":         "a cluster of vine tomatoes still attached to the green vine",
  "maggie-tomatoes":          "3 Maggie tomatoes (small, ridged, irregular) in a loose natural cluster",
  "mixed-cherry-tomatoes":    "a natural loose pile of colorful cherry tomatoes — red, yellow, and orange",

  // ── Peppers ───────────────────────────────────────────────────────────────
  "red-pepper":               "3 red bell peppers in a tight natural cluster",
  "green-pepper":             "3 green bell peppers in a tight natural cluster",
  "yellow-pepper":            "3 yellow bell peppers in a tight natural cluster",
  "orange-pepper":            "3 orange bell peppers in a tight natural cluster",
  "hot-pepper":               "5-6 hot chili peppers in a loose natural pile",
  "chili-mix":                "a small loose pile of mixed colored chili peppers — red, green, yellow",

  // ── Cucumbers / Zucchini ──────────────────────────────────────────────────
  "cucumber":                 "3 whole cucumbers lying naturally side-by-side, slightly overlapping",
  "zucchini":                 "3 zucchini lying naturally side-by-side",

  // ── Eggplant ──────────────────────────────────────────────────────────────
  "greenhouse-eggplant":      "2 whole glossy eggplants side by side, one slightly angled",
  "baladi-eggplant":          "2 whole round Baladi eggplants side by side",

  // ── Brassicas / Heads ─────────────────────────────────────────────────────
  "cauliflower":              "one whole cauliflower head",
  "broccoli":                 "one whole broccoli head",
  "white-cabbage":            "one whole white cabbage head",
  "red-cabbage":              "one whole red cabbage head",
  "white-cabbage-haslat":     "one whole white cabbage head",
  "red-cabbage-haslat":       "one whole red cabbage head",
  "kohlrabi":                 "2 fresh kohlrabi with trimmed stems, side by side",
  "fennel":                   "one fennel bulb with its feathery green fronds",
  "artichoke":                "2 whole artichokes side by side",
  "spaghetti-squash":         "one whole pale-yellow spaghetti squash",
  "japanese-pumpkin":         "one whole Japanese pumpkin (kabocha) — dark green with light ridges",

  // ── Lettuce / Leafy ───────────────────────────────────────────────────────
  "lettuce":                  "one whole round green lettuce head",
  "arabic-lettuce":           "one whole Arabic romaine lettuce head",
  "salanova":                 "one whole Salanova lettuce head",
  "beet-leaves":              "a bunch of beet leaves with stems gathered at the bottom",
  "celery":                   "a bunch of celery stalks with leaves, stems gathered at the bottom",

  // ── Herbs (upright bunches) ───────────────────────────────────────────────
  "parsley":                  "a bunch of flat-leaf parsley standing upright, stems gathered neatly at the bottom, filling the frame",
  "parsley-pack":             "a bunch of flat-leaf parsley standing upright, stems gathered at the bottom",
  "cilantro":                 "a bunch of fresh coriander standing upright, stems at the bottom",
  "dill":                     "a bunch of fresh dill standing upright, feathery tops spread naturally, stems at the bottom",
  "mint":                     "a small bunch of fresh mint standing upright, stems at the bottom",
  "lemon-verbena":            "a small bunch of fresh lemon verbena sprigs standing upright",
  "rosemary":                 "a small bunch of fresh rosemary sprigs",
  "thyme":                    "a small bunch of fresh thyme sprigs",
  "oregano":                  "a small bunch of fresh oregano",
  "green-onion":              "a bunch of fresh green onions standing upright, roots trimmed, stems at bottom",

  // ── Root vegetables ───────────────────────────────────────────────────────
  "carrot":                   "a bunch of 4-5 fresh carrots lying together, tops trimmed",
  "sweet-potato":             "2-3 sweet potatoes in a natural loose arrangement",
  "white-potatoes":           "3-4 white potatoes in a natural cluster",
  "red-potatoes":             "3-4 red potatoes in a natural cluster",
  "beetroot":                 "3 beets in a tight cluster, tops trimmed",
  "turnip":                   "3 turnips in a natural cluster",
  "ginger":                   "a fresh irregular piece of ginger root",

  // ── Onions / Garlic / Leek ────────────────────────────────────────────────
  "white-onion":              "3 white onions in a tight triangular cluster",
  "red-onion":                "3 red onions in a tight triangular cluster",
  "packed-garlic":            "a fresh garlic bulb with several cloves",
  "leek":                     "2 whole leek stalks lying side by side",
  "radish-bunch":             "a bunch of radishes with trimmed green tops",

  // ── Legumes / Other veg ───────────────────────────────────────────────────
  "broad-beans":              "a small natural handful of broad beans in their pods",
  "mushrooms-pack":           "a natural cluster of fresh white button mushrooms",
  "strawberry-box-haslat":    "an open clamshell container of fresh ripe strawberries",

  // ── Citrus ────────────────────────────────────────────────────────────────
  "orange":                   "3 oranges — two whole and one halved to show the juicy interior",
  "lemon":                    "3 lemons in a tight triangular cluster",
  "clementine":               "5-6 clementines in a loose natural pile",
  "red-grapefruit":           "3 red grapefruits in a triangular cluster, one halved",
  "pomelo":                   "2 pomelos side by side",
  "pomelit":                  "2-3 pomelit fruits in a natural cluster",

  // ── Stone / Tropical fruits ────────────────────────────────────────────────
  "watermelon":               "one whole watermelon",
  "melon":                    "one whole melon and one halved showing the orange flesh",
  "kiwi":                     "5-6 kiwi fruits in a natural loose pile",
  "pear":                     "3 pears in a tight triangular cluster",
  "chestnuts":                "a small natural pile of fresh chestnuts",
  "loquat":                   "a small natural pile of loquats, a few with leaves",
  "israeli-pineapple":        "one whole Israeli pineapple with crown",
  "imported-large-pineapple": "one large whole pineapple with crown",
  "blueberries":              "a natural pile of fresh blueberries",
  "banana":                   "a natural bunch of 5-6 bananas",
  "avocado":                  "one whole Hass avocado and one halved showing the green flesh and pit",
  "strawberry":               "5-6 fresh strawberries with green leaves in a loose natural pile",

  // ── Grapes ────────────────────────────────────────────────────────────────
  "premium-white-grapes":     "a full bunch of premium white/green grapes on the stem",
  "premium-black-grapes":     "a full bunch of premium dark/black grapes on the stem",
  "premium-red-grapes":       "a full bunch of premium red grapes on the stem",

  // ── Apples ────────────────────────────────────────────────────────────────
  "red-apple":                "3 red apples in a tight triangular cluster",
  "green-apple":              "3 green Granny Smith apples in a tight triangular cluster",
  "golden-apple":             "3 golden yellow apples in a tight triangular cluster",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert slug to readable English words when not in the subject map. */
function slugToWords(slug: string): string {
  return slug.replace(/-/g, " ");
}

/** Get the English subject description for the prompt. */
function getSubject(product: ProductEntry): string {
  return SLUG_SUBJECT[product.slug] ?? slugToWords(product.slug);
}

/** Get the composition instruction for the prompt. */
function getComposition(slug: string): string {
  if (SLUG_COMPOSITION[slug]) return SLUG_COMPOSITION[slug];
  // Reasonable default for unmapped slugs
  return "3 pieces in a tight natural triangular cluster, touching";
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildImagePrompt(product: ProductEntry): string {
  if (product.promptOverride) return product.promptOverride;

  const subject     = getSubject(product);
  const composition = getComposition(product.slug);

  // Note: a plain light background is intentional — it maximises contrast
  // for the ML/flood-fill background removal step that runs after generation.
  return `\
E-commerce grocery catalog photo of ${subject}.

ARRANGEMENT: ${composition}. Items fill 70-80% of the frame and are touching or slightly overlapping — not floating apart.

BACKGROUND: Plain white or very light neutral — completely clean and uniform. No props, no surface texture, no colored backdrop.

PRODUCE SURFACE: Completely dry. No water droplets anywhere. No condensation. No dew. No wet shine. Natural matte or slightly waxy skin texture only.

LIGHTING: Soft, diffused, even from above. No directional spotlight. No dramatic shadows. Very minimal soft shadow directly under the produce only.

STYLE: Real photograph of real fresh produce. Natural color variations and slight shape imperfections are correct. NOT a 3D render. NOT CGI. NOT an illustration. NOT an advertisement.

STRICTLY AVOID: water drops, condensation, dramatic shadows, reflective surfaces, decorative props, text, labels, watermarks, macro close-up, oversaturation, artificial perfection.`;
}
