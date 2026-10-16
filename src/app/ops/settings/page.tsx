import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementForm } from "./announcement-form";

export default async function SettingsPage() {
  await requireAccount("/ops/settings", ["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("key, value, description").order("key");
  const rows = (data ?? []) as { key: string; value: unknown; description: string | null }[];
  const a = (rows.find((r) => r.key === "announcement")?.value ?? {}) as { enabled?: boolean; message?: string | null; href?: string | null };

  return (
    <>
      <Card>
        <h2 className="mb-4 text-xl font-semibold">Announcement strip</h2>
        <AnnouncementForm enabled={Boolean(a.enabled)} message={a.message ?? ""} href={a.href ?? ""} />
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">All settings</h2>
        <dl className="mt-3 divide-y divide-line">
          {rows.map((r) => (
            <div key={r.key} className="py-3">
              <dt className="font-mono text-sm font-semibold text-navy">{r.key}</dt>
              <dd className="mt-1 font-mono text-xs break-all">{JSON.stringify(r.value)}</dd>
              {r.description ? <dd className="mt-1 text-sm text-muted">{r.description}</dd> : null}
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
