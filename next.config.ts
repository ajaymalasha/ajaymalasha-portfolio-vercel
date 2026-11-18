import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Photos and storefront captures are pre-sized by scripts/ and served as plain files.
  images: { unoptimized: true },
};

export default nextConfig;
