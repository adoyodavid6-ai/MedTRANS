import type { ReactNode } from "react";
import { Bell, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/sign-in/actions";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, portalsFor, type Role } from "@/lib/auth/roles";
import { SideNav, type SideNavItem } from "./side-nav";
import Link from "next/link";

/** Layout for signed-in areas: title, role badges, portal switcher, section nav, sign out. */
export async function AreaShell({
  title,
  roles,
  nav,
  children,
}: {
  title: string;
  roles: Role[];
  nav: SideNavItem[];
  children: ReactNode;
}) {
  const portals = portalsFor(roles);
  const supabase = await createClient();
  const { count: unread } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return (
    <div className="container-page py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium sm:text-3xl">{title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {roles.map((r) => (
              <Badge key={r} tone="primary">
                {ROLE_LABELS[r]}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/account/notifications" className="relative inline-flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-navy hover:border-primary">
            <Bell aria-hidden className="size-5" />
            <span className="sr-only">Notifications{unread ? `, ${unread} unread` : ""}</span>
            {unread ? <span aria-hidden className="absolute -top-1 -right-1 rounded-full bg-urgent px-1.5 text-xs font-bold text-white">{unread > 99 ? "99+" : unread}</span> : null}
          </Link>
          {portals.length > 1 ? (
            <nav aria-label="Switch area" className="flex flex-wrap gap-1">
              {portals.map((p) => (
                <Link key={p.key} href={p.href} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-3 text-sm font-medium text-navy hover:border-primary">
                  {p.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <form action={signOut}>
            <button type="submit" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted hover:bg-primary-soft hover:text-navy">
              <LogOut aria-hidden className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <aside className="min-w-0">
          <SideNav items={nav} label={`${title} sections`} />
        </aside>
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
