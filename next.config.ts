import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
