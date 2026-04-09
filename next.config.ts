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
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
