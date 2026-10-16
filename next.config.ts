import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

// Content Security Policy without nonces: nonces would force every page (including the
// static Emergency Help page) to render per request. 'unsafe-inline' scripts are still needed
// for Next.js's inline bootstrap; everything else is locked to our own origin and Supabase.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin}${isProd ? "" : " ws: wss:"}`.trim(),
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
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
    // Prescription uploads are up to 10 MB (images or PDF), plus multipart overhead.
    serverActions: { bodySizeLimit: "11mb" },
    proxyClientMaxBodySize: "11mb",
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
