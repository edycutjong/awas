import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Self-hosted fonts never change in place; page media is regenerated rarely, so it revalidates daily.
  async headers() {
    return [
      { source: "/fonts/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/landing/media/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
  // The story page and the pitch deck are static single-file pages in public/; give them clean URLs.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/about", destination: "/landing/index.html" },
        { source: "/pitch", destination: "/pitch/index.html" },
      ],
    };
  },
};

export default nextConfig;
