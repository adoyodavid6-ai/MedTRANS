import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { setModuleActive } from "./actions";
import { AreaActiveForm, BoundaryForm, CountryForm } from "./forms";

type Country = { code: string; name: string; currency: string; is_active: boolean; regulatory_review_ref: string | null };
type Area = { id: string; country_code: string; name: string; slug: string; is_active: boolean; notes: string | null; boundary_geojson: string | null; modules: Record<string, boolean> };

const MODULES: Record<string, string> = { pharmacy: "Pharmacy", doctorcare: "DoctorCare", emergency_guidance: "Emergency guidance" };

export default async function CoveragePage() {
  await requireAccount("/ops/coverage", ["admin"]);
  const supabase = await createClient();
  const [{ data: countries }, { data: areas, error }] = await Promise.all([
    supabase.from("countries").select("code, name, currency, is_active, regulatory_review_ref").order("code"),
    supabase.rpc("admin_list_areas"),
  ]);

  return (
    <>
      <Alert tone="info" title="Nothing goes live without its facts">
        <p>
          A country needs a recorded regulatory review. An area needs a confirmed boundary. Each service in an area is switched on
          separately. The database enforces these rules too.
        </p>
      </Alert>
      <section aria-labelledby="countries-heading" className="space-y-3">
        <h2 id="countries-heading" className="text-xl font-semibold">Countries</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {((countries ?? []) as Country[]).map((c) => (
            <Card key={c.code} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-navy">{c.name} ({c.code})</p>
                {c.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
              </div>
              {c.regulatory_review_ref ? <p className="text-sm text-muted">Review reference: {c.regulatory_review_ref}</p> : null}
              <CountryForm code={c.code} active={c.is_active} />
            </Card>
          ))}
        </div>
      </section>
      <section aria-labelledby="areas-heading" className="space-y-3">
        <h2 id="areas-heading" className="text-xl font-semibold">Coverage areas</h2>
        {error ? <Alert tone="warning" title="Couldn't load areas." /> : null}
        {((areas ?? []) as Area[]).map((a) => (
          <Card key={a.id} className="space-y-4" role="region" aria-labelledby={`area-${a.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p id={`area-${a.id}`} className="font-semibold text-navy">{a.name}</p>
              <Badge>{a.country_code}</Badge>
              {a.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
              {a.boundary_geojson ? <Badge tone="primary">Boundary set</Badge> : <Badge tone="warning">No boundary</Badge>}
            </div>
            {a.notes ? <p className="text-sm text-muted">{a.notes}</p> : null}
            <BoundaryForm area={a.id} geojson={a.boundary_geojson} />
            <AreaActiveForm area={a.id} active={a.is_active} />
            <div>
              <p className="text-sm font-semibold text-navy">Services in this area</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {Object.entries(MODULES).map(([key, label]) => {
                  const on = Boolean(a.modules[key]);
                  return (
                    <li key={key}>
                      <form action={setModuleActive}>
                        <input type="hidden" name="area" value={a.id} />
                        <input type="hidden" name="module" value={key} />
                        <input type="hidden" name="active" value={on ? "false" : "true"} />
                        <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm hover:border-primary" aria-pressed={on}>
                          <span className={on ? "size-2.5 rounded-full bg-primary" : "size-2.5 rounded-full bg-line"} aria-hidden />
                          {label}: {on ? "on" : "off"}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Card>
        ))}
      </section>
    </>
  );
}
