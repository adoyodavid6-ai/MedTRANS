import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Location is requested only by our own pages, only after an explicit tap. Camera/mic unused.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  // Cache Components is deliberately OFF. MedTRANS pages are either public (rendered statically)
  // or private per-user; server-side "use cache" of user data is a privacy risk we don't need.
  // Revisit in Phase 6 with a per-route review if static-shell performance requires it.
  cacheComponents: false,
  poweredByHeader: false,
  experimental: {
    // Enables forbidden() / unauthorized() for role-guarded pages and actions.
    authInterrupts: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
