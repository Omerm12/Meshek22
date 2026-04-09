import type { ImageLoaderProps } from "next/image";

/**
 * Custom Next.js image loader for Supabase Storage product images.
 *
 * Routes images through Supabase's image transformation API
 * (/storage/v1/render/image/public/…) so the CDN delivers a correctly
 * sized, compressed image instead of the full-size original.
 *
 * - Width comes from Next.js based on the `sizes` prop + device pixel ratio.
 * - Quality defaults to 80 (good balance of size vs. sharpness for product photos).
 * - resize=contain preserves aspect ratio without cropping.
 *
 * Requirements: Supabase project must have Image Transformations enabled
 * (available on Free plan with 50MB/month; Pro plan for higher volume).
 */
export default function supabaseImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  if (src.includes("/storage/v1/object/public/")) {
    const base = src.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );
    return `${base}?width=${width}&quality=${quality ?? 80}&resize=contain`;
  }

  // Fallback: return the URL unchanged.
  // This should not be reached when using this loader on ProductCard/ProductShell,
  // but acts as a safe no-op for any non-Storage URL that might be passed.
  return src;
}
