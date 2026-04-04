/**
 * Visual display config for categories and products.
 *
 * The database stores factual data (name, price, slug, etc.).
 * Emojis and color swatches are UI concerns kept here as stable config.
 * Keys are category/product slugs.
 */

export interface CategoryDisplay {
  icon: string;
  color: string;      // Tailwind bg class for category tile
  textColor: string;  // Tailwind text class
}

export interface ProductDisplay {
  icon: string;
  imageColor: string; // CSS color string for radial gradient background
}

// ─── Category display config ──────────────────────────────────────────────────

export const CATEGORY_DISPLAY: Record<string, CategoryDisplay> = {
  // ── Parent categories ────────────────────────────────────────────────────
  vegetables:               { icon: "🥬", color: "bg-green-50",   textColor: "text-green-700" },
  fruits:                   { icon: "🍎", color: "bg-red-50",     textColor: "text-red-700" },

  // ── Vegetable sub-categories ─────────────────────────────────────────────
  "regular-vegetables":     { icon: "🥦", color: "bg-green-50",   textColor: "text-green-700" },
  "root-vegetables":        { icon: "🥕", color: "bg-orange-50",  textColor: "text-orange-700" },
  "leafy-vegetables":       { icon: "🥬", color: "bg-emerald-50", textColor: "text-emerald-700" },
  herbs:                    { icon: "🌿", color: "bg-teal-50",    textColor: "text-teal-700" },
  "special-vegetables":     { icon: "🫑", color: "bg-lime-50",    textColor: "text-lime-700" },
  "cut-washed-vegetables":  { icon: "🔪", color: "bg-green-50",   textColor: "text-green-700" },
  "vegetable-trays":        { icon: "🥗", color: "bg-lime-50",    textColor: "text-lime-700" },

  // ── Fruit sub-categories ─────────────────────────────────────────────────
  "citrus-fruits":          { icon: "🍊", color: "bg-orange-50",  textColor: "text-orange-700" },
  "regular-fruits":         { icon: "🍎", color: "bg-red-50",     textColor: "text-red-700" },
  "special-fruits":         { icon: "🍇", color: "bg-purple-50",  textColor: "text-purple-700" },
  "dried-fruits":           { icon: "🍑", color: "bg-amber-50",   textColor: "text-amber-700" },
  "organic-fruits":         { icon: "🌱", color: "bg-green-50",   textColor: "text-green-700" },

  // ── Legacy slugs (backwards compat) ─────────────────────────────────────
  yerakot:                  { icon: "🥬", color: "bg-green-50",   textColor: "text-green-700" },
  perot:                    { icon: "🍎", color: "bg-red-50",     textColor: "text-red-700" },
  "isvey-tivul":            { icon: "🌿", color: "bg-teal-50",    textColor: "text-teal-700" },
  shoresh:                  { icon: "🥕", color: "bg-orange-50",  textColor: "text-orange-700" },
  beitsim:                  { icon: "🥚", color: "bg-yellow-50",  textColor: "text-yellow-700" },
  salatim:                  { icon: "🥗", color: "bg-lime-50",    textColor: "text-lime-700" },
};

const DEFAULT_CATEGORY_DISPLAY: CategoryDisplay = {
  icon: "🛒",
  color: "bg-stone-50",
  textColor: "text-stone-700",
};

export function getCategoryDisplay(slug: string): CategoryDisplay {
  return CATEGORY_DISPLAY[slug] ?? DEFAULT_CATEGORY_DISPLAY;
}

// ─── Product display config ───────────────────────────────────────────────────

export const PRODUCT_DISPLAY: Record<string, ProductDisplay> = {
  // ירקות
  agvaniya:          { icon: "🍅", imageColor: "#fecaca" },
  melafelon:         { icon: "🥒", imageColor: "#bbf7d0" },
  pilpel:            { icon: "🫑", imageColor: "#d9f99d" },
  batzal:            { icon: "🧅", imageColor: "#fef9c3" },
  shum:              { icon: "🧄", imageColor: "#faf5ff" },
  gezer:             { icon: "🥕", imageColor: "#fed7aa" },
  teredinyon:        { icon: "🥔", imageColor: "#fef3c7" },
  "tapuah-adama":    { icon: "🥔", imageColor: "#fef3c7" },
  broccoli:          { icon: "🥦", imageColor: "#bbf7d0" },
  karfit:            { icon: "🥦", imageColor: "#e0f2fe" },
  // פירות
  tapuah:            { icon: "🍎", imageColor: "#fecaca" },
  avocado:           { icon: "🥑", imageColor: "#d9f99d" },
  banana:            { icon: "🍌", imageColor: "#fef9c3" },
  mango:             { icon: "🥭", imageColor: "#fed7aa" },
  tutim:             { icon: "🍓", imageColor: "#fecaca" },
  limon:             { icon: "🍋", imageColor: "#fef9c3" },
  tapuz:             { icon: "🍊", imageColor: "#fed7aa" },
  // עשבי תיבול
  petrozilya:        { icon: "🌿", imageColor: "#dcfce7" },
  kusbarah:          { icon: "🌿", imageColor: "#d1fae5" },
  nana:              { icon: "🌱", imageColor: "#ecfdf5" },
  bazilikon:         { icon: "🌿", imageColor: "#dcfce7" },
  shamir:            { icon: "🌿", imageColor: "#f0fdf4" },
};

const DEFAULT_PRODUCT_DISPLAY: ProductDisplay = {
  icon: "🛒",
  imageColor: "#f0fdf4",
};

export function getProductDisplay(slug: string): ProductDisplay {
  return PRODUCT_DISPLAY[slug] ?? DEFAULT_PRODUCT_DISPLAY;
}
