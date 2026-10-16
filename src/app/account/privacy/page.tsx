import Link from "next/link";
import { Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { CONSENT_PURPOSES, OPTIONAL_PURPOSES, type ConsentPurpose } from "@/lib/consent/purposes";
import { getMyConsents } from "@/lib/consent/server";
import { createClient } from "@/lib/supabase/server";
import { cancelErasure, setOptionalConsent } from "./actions";
import { ErasureForm } from "./erasure-form";

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));

export default async function PrivacyPage() {
  const user = await requireAccount("/account/privacy");
  const consents = await getMyConsents();
  const required: ConsentPurpose[] = ["terms_of_service", "privacy_notice"];
  const supabase = await createClient();
  const { data: requests } = await supabase.from("data_subject_requests").select("kind, status, created_at, completed_at, outcome_note").eq("user_id", user.id).order("created_at", { ascending: false });
  const lastExport = (requests ?? []).find((r) => r.kind === "export");
  const openErasure = (requests ?? []).find((r) => r.kind === "erasure" && ["received", "in_progress"].includes(r.status));
  const lastClosed = (requests ?? []).find((r) => r.kind === "erasure" && r.completed_at);

  return (
    <>
      <Card>
        <h2 className="text-xl font-semibold">Your choices</h2>
        <p className="mt-1 text-[0.95rem] text-muted">
          Change these at any time. Each change is recorded with the date, so you always have a history.
        </p>
        <ul className="mt-5 divide-y divide-line">
          {OPTIONAL_PURPOSES.map((p) => {
            const c = consents.get(p);
            const on = Boolean(c?.granted);
            return (
              <li key={p} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-navy">{CONSENT_PURPOSES[p].label}</p>
                  <p className="text-sm text-muted">
                    {c ? `${on ? "Allowed" : "Not allowed"} since ${fmt(c.recorded_at)}` : "Not allowed — you haven't chosen yet"}
                  </p>
                </div>
                <form action={setOptionalConsent}>
                  <input type="hidden" name="purpose" value={p} />
                  <input type="hidden" name="granted" value={on ? "false" : "true"} />
                  <button className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-navy hover:border-primary">
                    {on ? "Withdraw" : "Allow"}
                    <span className="sr-only"> {CONSENT_PURPOSES[p].label}</span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">Accepted policies</h2>
        <ul className="mt-3 space-y-2">
          {required.map((p) => {
            const c = consents.get(p);
            return (
              <li key={p} className="flex flex-wrap items-center gap-2 text-[0.95rem]">
                <span className="font-medium">{CONSENT_PURPOSES[p].label}</span>
                {c?.granted ? <Badge tone="success">Accepted {fmt(c.recorded_at)} · version {c.policy_version}</Badge> : <Badge>Not accepted</Badge>}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Download your data</h2>
        <p className="text-[0.95rem]">Get a copy of the personal information MedTRANS holds about you, as a file you can keep. It includes your profile, addresses, orders, prescriptions (details, not the files), home visits and support messages.</p>
        <form method="post" action="/account/privacy/export">
          <Button type="submit" variant="secondary"><Download aria-hidden className="size-4" />Download my data</Button>
        </form>
        {lastExport ? <p className="text-sm text-muted">Last downloaded {fmt(lastExport.created_at)}.</p> : null}
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Delete your account</h2>
        {openErasure ? (
          <>
            <Alert tone="info" title="We have your deletion request">
              <p>Received {fmt(openErasure.created_at)}. Our data protection team will finish any open orders or visits with you first, then delete your information and tell you what we had to keep.</p>
            </Alert>
            {openErasure.status === "received" ? <form action={cancelErasure}><Button type="submit" variant="ghost">Withdraw my request</Button></form> : null}
          </>
        ) : (
          <>
            <p className="text-[0.95rem]">We will delete your profile, saved addresses, household members and messages. By law, we must keep some records for a set period: pharmacy dispensing and payment records, prescriptions and clinical visit notes. Those are kept securely and are not used for anything else.</p>
            {lastClosed ? <p className="text-sm text-muted">Your last request was {lastClosed.status} on {fmt(lastClosed.completed_at as string)}{lastClosed.outcome_note ? `: ${lastClosed.outcome_note}` : "."}</p> : null}
            <ErasureForm />
          </>
        )}
        <p className="text-sm text-muted">Questions about your data? <Link href="/contact" className="underline">Contact us</Link>.</p>
      </Card>
    </>
  );
}
