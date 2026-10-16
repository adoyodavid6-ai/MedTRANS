import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { PUBLIC_ROUTES } from "@/lib/site/routes";

// Only live, indexable pages. Placeholder pages are excluded until they hold real content (§19).
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.filter((r) => r.status === "live" && !("noindex" in r && r.noindex)).map((r) => ({
    url: `${siteUrl}${r.href === "/" ? "" : r.href}`,
    changeFrequency: "monthly",
    priority: r.href === "/" ? 1 : r.href === "/emergency" ? 0.9 : 0.6,
  }));
}
