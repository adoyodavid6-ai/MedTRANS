import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AddContactForm, ContactActions } from "./forms";

type Contact = { id: string; country_code: string; label: string; phone_number: string; description: string | null; source: string | null; verified_at: string | null; is_active: boolean };

export default async function EmergencyContactsPage() {
  await requireAccount("/ops/emergency-contacts", ["admin"]);
  const supabase = await createClient();
  const [{ data: contacts }, { data: countries }] = await Promise.all([
    supabase.from("emergency_contacts").select("id, country_code, label, phone_number, description, source, verified_at, is_active").order("country_code").order("display_order"),
    supabase.from("countries").select("code, name").order("code"),
  ]);

  return (
    <>
      <Alert tone="urgent" title="These numbers appear on Emergency Help">
        <p>
          Only publish a number you have verified against an official source. Changing a number removes its verification and
          takes it off the public page automatically.
        </p>
      </Alert>
      <section aria-labelledby="contacts-heading" className="space-y-3">
        <h2 id="contacts-heading" className="text-xl font-semibold">Numbers</h2>
        {((contacts ?? []) as Contact[]).length === 0 ? (
          <p className="text-muted">No emergency numbers recorded. Emergency Help currently tells visitors that no verified number is listed.</p>
        ) : (
          ((contacts ?? []) as Contact[]).map((c) => (
            <Card key={c.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-navy">{c.label}: {c.phone_number}</p>
                <Badge>{c.country_code}</Badge>
                {c.is_active ? <Badge tone="success">Published</Badge> : <Badge>Not published</Badge>}
              </div>
              {c.description ? <p className="text-sm">{c.description}</p> : null}
              <p className="text-sm text-muted">Source: {c.source ?? "—"}</p>
              <p className="text-sm text-muted">
                {c.verified_at ? `Verified ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(c.verified_at))}` : "Not verified"}
              </p>
              <ContactActions id={c.id} active={c.is_active} />
            </Card>
          ))
        )}
      </section>
      <Card>
        <h2 className="mb-4 text-xl font-semibold">Add a verified number</h2>
        <AddContactForm countries={(countries ?? []) as { code: string; name: string }[]} />
      </Card>
    </>
  );
}
