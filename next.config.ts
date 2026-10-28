import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Cache optimized images for 30 days (default is 60 s).
    // Applies to local/banner images processed by Next.js's built-in optimizer.
    minimumCacheTTL: 2592000,
    remotePatterns: [
      // Supabase Storage: original object URLs (used by ProductShell, etc.)
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      // Supabase Image Transformation API: render/resize URLs
      // (used by supabaseImageLoader in ProductCard/ProductShell)
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/render/image/public/**",
      },
    ],
  },
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      // SAMEORIGIN, not DENY: the admin invoice print page embeds the invoice
      // PDF in a same-origin iframe.
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
    ];
    return [
      { source: "/:path*", headers: common },
      // The administrator portal must never be indexed or cached by a shared cache.
      {
        source: "/meshek22-control/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
