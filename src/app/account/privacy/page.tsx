import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { CONSENT_PURPOSES, OPTIONAL_PURPOSES, type ConsentPurpose } from "@/lib/consent/purposes";
import { getMyConsents } from "@/lib/consent/server";
import { setOptionalConsent } from "./actions";

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));

export default async function PrivacyPage() {
  await requireAccount("/account/privacy");
  const consents = await getMyConsents();
  const required: ConsentPurpose[] = ["terms_of_service", "privacy_notice"];

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
        <p className="mt-4 text-sm text-muted">
          To close your account, export your data or ask us to delete it, contact us via the <Link href="/contact" className="underline">contact page</Link>.
          A self-service request flow opens with our support system.
        </p>
      </Card>
    </>
  );
}
