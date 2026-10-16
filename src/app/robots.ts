import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/account", "/portal", "/ops", "/sign-in", "/welcome"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
