import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { PRESCRIPTION_STATUS, suggestedValidUntil } from "@/lib/pharmacy/status";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "../../forms";

type Rx = {
  id: string; status: string; created_at: string; file_name: string; mime_type: string; patient_note: string | null; valid_until: string | null;
  household_member_id: string | null;
  prescription_items: { product_id: string; quantity_requested: number; quantity_approved: number | null; medicine_products: { name: string; strength: string; dosage_form: string } }[];
  prescription_reviews: { decision: string; note_to_patient: string | null; created_at: string }[];
};

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAccount(`/portal/pharmacy/prescriptions/${id}`, ["pharmacist", "pharmacy_admin"]);
  const supabase = await createClient();
  // RLS returns this only to verified pharmacists at the receiving pharmacy.
  const { data } = await supabase
    .from("prescriptions")
    .select("id, status, created_at, file_name, mime_type, patient_note, valid_until, household_member_id, prescription_items(product_id, quantity_requested, quantity_approved, medicine_products(name, strength, dosage_form)), prescription_reviews(decision, note_to_patient, created_at)")
    .eq("id", id).maybeSingle();
  const rx = data as unknown as Rx | null;
  if (!rx) notFound();
  const st = PRESCRIPTION_STATUS[rx.status];
  return (
    <>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">Prescription review</h2>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <p className="text-sm text-muted">Received {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(rx.created_at))}{rx.household_member_id ? " · for a household member of the account holder" : ""}</p>
        <a href={`/prescriptions/${rx.id}/file`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-primary underline">
          Open the prescription file ({rx.mime_type === "application/pdf" ? "PDF" : "image"}) — access is recorded
        </a>
        {rx.patient_note ? <p className="rounded-lg bg-background p-3 text-[0.95rem]"><strong>Patient note:</strong> {rx.patient_note}</p> : null}
        <div>
          <h3 className="font-semibold">Requested</h3>
          <ul className="mt-1 text-[0.95rem]">
            {rx.prescription_items.map((i) => (
              <li key={i.product_id}>{i.quantity_requested} × {i.medicine_products.name} ({i.medicine_products.strength}, {i.medicine_products.dosage_form}){i.quantity_approved !== null ? ` — approved ${i.quantity_approved}` : ""}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted">Check the prescription is genuine, current, legible, for this patient, and matches exactly what was requested. Different strengths or forms are not interchangeable.</p>
      </Card>
      {rx.status === "submitted" ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Your decision</h2>
          <ReviewForm id={rx.id} defaultValidUntil={suggestedValidUntil()} items={rx.prescription_items.map((i) => ({ product_id: i.product_id, name: i.medicine_products.name, requested: i.quantity_requested }))} />
        </Card>
      ) : (
        <Card>
          <h2 className="text-lg font-semibold">History</h2>
          <ul className="mt-2 text-[0.95rem]">{rx.prescription_reviews.map((r) => <li key={r.created_at}>{PRESCRIPTION_STATUS[r.decision]?.label}: {r.note_to_patient ?? "—"}</li>)}</ul>
        </Card>
      )}
    </>
  );
}
