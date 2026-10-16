import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ScreeningReviewForm, ServiceForm } from "../care-forms";
import { toggleService } from "../care-actions";

export default async function CareServices() {
  await requireAccount("/ops/care-services", ["admin"]);
  const supabase = await createClient();
  const [{ data: services }, { data: questions }] = await Promise.all([
    supabase.from("care_services").select("id, name, required_profession, duration_minutes, is_active, eligibility_notes").order("name"),
    supabase.from("care_screening_questions").select("id, position, question, clinically_reviewed_by, clinically_reviewed_at").eq("is_active", true).order("position"),
  ]);
  const unreviewed = (questions ?? []).some((q) => !q.clinically_reviewed_at);
  return (
    <>
      <Card className="space-y-3">
        <h2 className="text-xl font-semibold">Home-care services</h2>
        <ul className="divide-y divide-line">
          {(services ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span>{s.name} · {s.required_profession} · {s.duration_minutes} min {s.eligibility_notes?.includes("[[CONFIRM") ? <Badge tone="warning">Clinical criteria to confirm</Badge> : null}</span>
              <form action={toggleService} className="flex items-center gap-2">
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={s.is_active ? "false" : "true"} />
                {s.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
                <button className="min-h-11 rounded-xl border border-line px-3 text-sm">{s.is_active ? "Deactivate" : "Activate"}</button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Urgent-symptom screening</h2>
        {unreviewed ? <Alert tone="warning" title="Not clinically reviewed: home-visit requests are blocked until it is" /> : <Alert tone="success" title="Clinically reviewed" />}
        <ol className="list-decimal space-y-1 pl-5 text-[0.95rem]">
          {(questions ?? []).map((q) => <li key={q.id}>{q.question}{q.clinically_reviewed_by ? <span className="text-sm text-muted"> (reviewed by {q.clinically_reviewed_by})</span> : null}</li>)}
        </ol>
        <ScreeningReviewForm />
      </Card>
      <Card><h2 className="mb-3 text-lg font-semibold">Add a service</h2><ServiceForm /></Card>
    </>
  );
}
