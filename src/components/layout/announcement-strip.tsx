import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { createAnonClient } from "@/lib/supabase/server";

type Announcement = { enabled?: boolean; message?: string | null; href?: string | null };

/**
 * Configurable service-update strip (§6A). Content comes only from the admin-managed
 * `announcement` setting; nothing is shown when it is disabled or can't be loaded.
 */
export async function AnnouncementStrip() {
  if (!isSupabaseConfigured()) return null;
  let a: Announcement | null = null;
  try {
    const { data } = await createAnonClient()
      .from("platform_settings")
      .select("value")
      .eq("key", "announcement")
      .maybeSingle();
    a = (data?.value as Announcement | undefined) ?? null;
  } catch {
    return null;
  }
  if (!a?.enabled || !a.message) return null;

  const href = a.href && a.href.startsWith("/") && !a.href.startsWith("//") ? a.href : null;
  return (
    <div className="bg-navy text-sm text-white">
      <p className="container-page py-2 text-center">
        {a.message}
        {href ? (
          <>
            {" "}
            <Link href={href} className="font-semibold underline underline-offset-2">
              Learn more
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
