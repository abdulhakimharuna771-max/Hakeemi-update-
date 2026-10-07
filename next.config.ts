import type { NextConfig } from "next";

/**
 * Dev origins allowed to reach the dev server.
 *
 * Next.js blocks cross-origin dev requests unless the hostname is listed, and
 * the Arena preview proxies the app through *.e2b.app. Production builds ignore
 * this entirely.
 */
const allowedDevOrigins = (
  process.env.NEXT_ALLOWED_DEV_ORIGINS ??
  "*.e2b.app,localhost,127.0.0.1"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,

  // Cache Components (PPR) and partialPrefetching are deliberately NOT enabled:
  // partialPrefetching requires cacheComponents, and every portal route is
  // per-user and reads cookies. Request-time rendering is the correct model
  // here, and enabling PPR would force Suspense boundaries around all
  // authenticated data for no benefit.

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
