import Link from "next/link";
import { Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { markAllRead } from "./actions";

export default async function Notifications() {
  await requireAccount("/account/notifications");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("id, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(100);
  const rows = data ?? [];
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));
  return (
    <section aria-labelledby="n-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="n-heading" className="text-xl font-semibold">Notifications</h2>
        {rows.some((r) => !r.read_at) ? <form action={markAllRead}><button className="min-h-11 text-sm font-semibold text-primary underline">Mark all as read</button></form> : null}
      </div>
      <p className="text-sm text-muted">Messages we send by SMS or email never include medical details, so they are safe on a shared phone.</p>
      {rows.length === 0 ? <EmptyState icon={Bell} title="No notifications yet" /> : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-line">
            {rows.map((n) => (
              <li key={n.id} className="flex gap-3 p-4">
                <span aria-hidden className={n.read_at ? "mt-2 size-2 shrink-0 rounded-full bg-transparent" : "mt-2 size-2 shrink-0 rounded-full bg-primary"} />
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{n.link ? <Link href={n.link} className="underline-offset-2 hover:underline">{n.title}</Link> : n.title}{!n.read_at ? <span className="sr-only"> (unread)</span> : null}</p>
                  <p className="text-[0.95rem]">{n.body}</p>
                  <p className="text-xs text-muted">{fmt(n.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
