import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { removeHouseholdMember } from "./actions";
import { RELATIONSHIPS } from "./relationships";
import { HouseholdForm } from "./household-form";

type Member = { id: string; full_name: string; relationship: keyof typeof RELATIONSHIPS; date_of_birth: string | null };

export default async function HouseholdPage() {
  await requireAccount("/account/household");
  const supabase = await createClient();
  const { data } = await supabase.from("household_members").select("id, full_name, relationship, date_of_birth").order("created_at");
  const members = (data ?? []) as Member[];

  return (
    <>
      <section aria-labelledby="household-heading" className="space-y-3">
        <h2 id="household-heading" className="text-xl font-semibold">Household</h2>
        <p className="text-[0.95rem] text-muted">People you arrange care for. Only you can see this list.</p>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No household members yet">
            Add a child, parent or other dependant to order medicines or request visits for them.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-navy">{m.full_name}</p>
                  <p className="text-sm text-muted">
                    {RELATIONSHIPS[m.relationship]}
                    {m.date_of_birth ? ` · born ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(m.date_of_birth))}` : ""}
                  </p>
                </div>
                <form action={removeHouseholdMember}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-urgent hover:bg-urgent-soft">
                    Remove<span className="sr-only"> {m.full_name}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Card>
        <h2 className="mb-4 text-xl font-semibold">Add someone</h2>
        <HouseholdForm relationships={RELATIONSHIPS} />
      </Card>
    </>
  );
}
