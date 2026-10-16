import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { deleteAddress, makeDefaultAddress } from "./actions";
import { AddressForm } from "./address-form";

type Address = {
  id: string;
  label: string;
  line1: string;
  area: string | null;
  building_details: string | null;
  landmark: string | null;
  location: unknown;
  is_default: boolean;
};

export default async function AddressesPage() {
  await requireAccount("/account/addresses");
  const supabase = await createClient();
  const { data } = await supabase
    .from("addresses")
    .select("id, label, line1, area, building_details, landmark, location, is_default")
    .order("is_default", { ascending: false })
    .order("created_at");
  const addresses = (data ?? []) as Address[];

  return (
    <>
      <section aria-labelledby="saved-heading" className="space-y-3">
        <h2 id="saved-heading" className="text-xl font-semibold">Saved addresses</h2>
        {addresses.length === 0 ? (
          <EmptyState icon={MapPin} title="No saved addresses yet">
            Save the places you&apos;d like medicines delivered or visits made to.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id}>
                <Card className="h-full">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-navy">{a.label}</p>
                    {a.is_default ? <Badge tone="primary">Default</Badge> : null}
                    {a.location ? <Badge>Pinned</Badge> : null}
                  </div>
                  <p className="mt-2 text-[0.95rem]">{[a.line1, a.area].filter(Boolean).join(", ")}</p>
                  {a.building_details ? <p className="text-sm text-muted">{a.building_details}</p> : null}
                  {a.landmark ? <p className="text-sm text-muted">Near {a.landmark}</p> : null}
                  <div className="mt-3 flex gap-2">
                    {!a.is_default ? (
                      <form action={makeDefaultAddress}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary-soft">Make default</button>
                      </form>
                    ) : null}
                    <form action={deleteAddress}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-urgent hover:bg-urgent-soft">
                        Delete<span className="sr-only"> {a.label}</span>
                      </button>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Card>
        <h2 className="mb-4 text-xl font-semibold">Add an address</h2>
        <AddressForm />
      </Card>
    </>
  );
}
