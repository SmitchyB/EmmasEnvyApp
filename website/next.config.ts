import type { NextConfig } from "next";
import path from "node:path";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const apiHost = new URL(apiUrl).hostname;
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  transpilePackages: ["@emmasenvy/shared"],
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  images: {
    // Next.js 16 blocks private IPs (localhost API uploads) unless enabled for local dev
    dangerouslyAllowLocalIP: isDev,
    remotePatterns: [
      { protocol: "http", hostname: "localhost", pathname: "/uploads/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/uploads/**" },
      { protocol: "https", hostname: apiHost, pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
