import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.maplestorywiki.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
