import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { ROLE_LABELS, isRole } from "@/lib/auth/roles";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RoleForm } from "./role-form";

type Row = { id: string; email: string | null; phone: string | null; full_name: string | null; created_at: string; last_sign_in_at: string | null; roles: string[] };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAccount("/ops/users", ["admin"]);
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", { search: q || null, max_rows: 50 });
  const rows = (data ?? []) as Row[];

  return (
    <>
      <Card>
        <h2 className="text-xl font-semibold">Users & roles</h2>
        <p className="mt-1 text-sm text-muted">
          Granting a professional role does not verify anyone. Provider and pharmacy verification is a separate, recorded check
          that opens with each module. Every lookup and change here is audited.
        </p>
        <form className="mt-4 flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">Search by name, phone or email</label>
          <Input id="q" name="q" defaultValue={q} placeholder="Search by name, phone or email" />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </Card>
      {error ? <Alert tone="warning" title="Couldn't load users." /> : null}
      <ul className="space-y-3">
        {rows.map((u) => {
          const roles = u.roles.filter(isRole);
          return (
            <li key={u.id}>
              <Card className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold text-navy">{u.full_name ?? "No name given"}</p>
                    <p className="text-sm text-muted">{[u.phone ? `+${u.phone.replace(/^\+/, "")}` : null, u.email].filter(Boolean).join(" · ")}</p>
                  </div>
                  <p className="text-xs text-muted">
                    Joined {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(u.created_at))}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((r) => <Badge key={r} tone="primary">{ROLE_LABELS[r]}</Badge>)}
                </div>
                <RoleForm userId={u.id} current={roles} />
              </Card>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && !error ? <p className="text-muted">No matching users.</p> : null}
    </>
  );
}
