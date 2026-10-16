import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { PRESCRIPTION_STATUS } from "@/lib/pharmacy/status";
import { createClient } from "@/lib/supabase/server";
import { withdrawPrescription } from "./actions";

type Rx = {
  id: string; status: string; file_name: string; created_at: string; valid_until: string | null; pharmacies: { name: string };
  prescription_items: { quantity_requested: number; quantity_approved: number | null; medicine_products: { name: string } }[];
  prescription_reviews: { note_to_patient: string | null; created_at: string }[];
};

export default async function PrescriptionsPage() {
  await requireAccount("/account/prescriptions");
  const supabase = await createClient();
  const { data } = await supabase
    .from("prescriptions")
    .select("id, status, file_name, created_at, valid_until, pharmacies(name), prescription_items(quantity_requested, quantity_approved, medicine_products(name)), prescription_reviews(note_to_patient, created_at)")
    .order("created_at", { ascending: false });
  const rxs = (data ?? []) as unknown as Rx[];
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
  return (
    <section aria-labelledby="rx-heading" className="space-y-3">
      <h2 id="rx-heading" className="text-xl font-semibold">Prescriptions</h2>
      <p className="text-[0.95rem] text-muted">Only you and the reviewing pharmacist can open these files. Every time a file is opened, it is recorded.</p>
      {rxs.length === 0 ? <EmptyState icon={FileText} title="No prescriptions yet">Prescriptions you upload for an order appear here with the pharmacist&apos;s decision.</EmptyState> : null}
      {rxs.map((r) => {
        const st = PRESCRIPTION_STATUS[r.status];
        const note = [...r.prescription_reviews].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.note_to_patient;
        return (
          <Card key={r.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-navy">{r.pharmacies.name}</p>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            <p className="text-sm text-muted">Sent {fmt(r.created_at)}{r.valid_until ? ` · approval valid until ${fmt(r.valid_until)}` : ""}</p>
            <ul className="text-[0.95rem]">
              {r.prescription_items.map((i) => (
                <li key={i.medicine_products.name}>{i.medicine_products.name}: requested {i.quantity_requested}{i.quantity_approved !== null ? `, approved ${i.quantity_approved}` : ""}</li>
              ))}
            </ul>
            {note ? <p className="rounded-lg bg-background p-3 text-[0.95rem]"><strong>Pharmacist:</strong> {note}</p> : null}
            <div className="flex flex-wrap gap-3">
              <a href={`/prescriptions/${r.id}/file`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">View file</a>
              {["submitted", "clarification_needed"].includes(r.status) ? (
                <form action={withdrawPrescription}><input type="hidden" name="id" value={r.id} /><button className="min-h-11 text-sm font-semibold text-urgent underline">Withdraw</button></form>
              ) : null}
            </div>
          </Card>
        );
      })}
    </section>
  );
}
