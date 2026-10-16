import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { PUBLIC_ROUTES } from "@/lib/site/routes";
import { createAnonClient } from "@/lib/supabase/server";

// Built per request (crawlers fetch it rarely) so a newly verified pharmacy, or a withdrawn article, is reflected at once.
export const dynamic = "force-dynamic";

/**
 * Live, indexable pages plus public records that are actually usable:
 * listed pharmacies, active medicines, active care services, verified providers and reviewed articles.
 * Placeholder and personal pages are excluded (§19).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => `${siteUrl}${path === "/" ? "" : path}`;
  const out: MetadataRoute.Sitemap = PUBLIC_ROUTES.filter((r) => r.status === "live" && !("noindex" in r && r.noindex)).map((r) => ({
    url: url(r.href),
    changeFrequency: "monthly",
    priority: r.href === "/" ? 1 : r.href === "/emergency" ? 0.9 : 0.6,
  }));
  try {
    const db = createAnonClient();
    const [ph, meds, services, providers, articles] = await Promise.all([
      db.rpc("pharmacy_directory"),
      db.rpc("search_medicines", { q: null, max_rows: 100 }),
      db.from("care_services").select("slug").eq("is_active", true),
      db.rpc("provider_directory"),
      db.from("articles").select("slug, updated_at").eq("is_published", true),
    ]);
    for (const p of (ph.data ?? []) as { slug: string; verification_status: string }[]) if (p.verification_status === "verified") out.push({ url: url(`/pharmacies/${p.slug}`), changeFrequency: "weekly", priority: 0.5 });
    for (const m of (meds.data ?? []) as { slug: string }[]) out.push({ url: url(`/pharmacy/medicines/${m.slug}`), changeFrequency: "weekly", priority: 0.5 });
    for (const s of services.data ?? []) out.push({ url: url(`/doctorcare/services/${s.slug}`), changeFrequency: "monthly", priority: 0.5 });
    for (const p of (providers.data ?? []) as { provider_id: string }[]) out.push({ url: url(`/providers/${p.provider_id}`), changeFrequency: "monthly", priority: 0.4 });
    for (const a of articles.data ?? []) out.push({ url: url(`/resources/${a.slug}`), lastModified: a.updated_at, changeFrequency: "monthly", priority: 0.5 });
  } catch {
    // Database unreachable (e.g. at build time): fall back to the static pages only.
  }
  return out;
}
