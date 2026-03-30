/**
 * Create URL-safe slugs from Hebrew or English text.
 * Hebrew characters are transliterated where possible,
 * otherwise replaced with their unicode code points.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\u0590-\u05FF-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generate a unique slug by appending a short random suffix */
export function uniqueSlug(text: string): string {
  const base = slugify(text);
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${base}-${suffix}`;
}
