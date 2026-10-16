import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Phone, Siren } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getVerifiedEmergencyContacts, isEmergencyOperationStaffed, telHref } from "@/lib/emergency/contacts";
import { site } from "@/lib/site/config";
import { CallbackForm } from "./callback-form";
import { ShareLocation } from "./share-location";

export const metadata: Metadata = {
  title: "Emergency Help",
  description: "If someone's life may be at risk, contact local emergency services now. What to do and what to say.",
  alternates: { canonical: "/emergency" },
};

// Verified numbers are re-read every five minutes; the guidance itself is static and always renders.
export const revalidate = 300;

/*
 * Masterplan §10. Rules this page keeps:
 *  - Guidance is the first thing on the page and is never behind a form, sign-in or confirmation.
 *  - A number is shown only if it is verified in the database, with a recorded source.
 *  - MedTRANS never implies it dispatches help. There is no request form until a real,
 *    staffed operation exists (Phase 4 decides; see [[CONFIRM: staffed emergency operation]]).
 *  - [[CONFIRM: clinical review of emergency guidance copy]] before launch.
 */
export default async function EmergencyPage() {
  const result = await getVerifiedEmergencyContacts(site.pilot.countryCode);
  const staffed = await isEmergencyOperationStaffed();
  const contacts = result.state === "ok" ? result.contacts : [];

  return (
    <div className="bg-urgent-soft/40">
      <div className="container-page max-w-3xl space-y-6 py-6 sm:py-10">
        <header className="space-y-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-urgent">
            <Siren aria-hidden className="size-5" />
            Emergency Help
          </p>
          <h1 className="text-[1.75rem] font-bold text-[#7a1717] sm:text-4xl">
            If someone&apos;s life may be at risk, contact local emergency services now.
          </h1>
          <p className="text-lg">
            Signs include: not breathing or struggling to breathe, unconscious or not responding, severe bleeding, chest pain,
            sudden weakness or confusion, a seizure, or a serious injury.
          </p>
        </header>

        <section aria-labelledby="numbers-heading">
          <h2 id="numbers-heading" className="sr-only">
            Emergency numbers
          </h2>
          {contacts.length > 0 ? (
            <ul className="space-y-3">
              {contacts.map((c) => (
                <li key={c.id}>
                  <a
                    href={telHref(c.phone_number)}
                    className="flex min-h-16 items-center justify-between gap-4 rounded-2xl bg-urgent px-5 py-4 text-white hover:bg-urgent-hover"
                  >
                    <span>
                      <span className="block text-lg font-semibold">Call {c.label}</span>
                      {c.description ? <span className="block text-sm text-white/90">{c.description}</span> : null}
                    </span>
                    <span className="inline-flex items-center gap-2 text-2xl font-bold">
                      <Phone aria-hidden className="size-6" />
                      {c.phone_number}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Alert tone="urgent" title={result.state === "ok" ? "No verified number is listed yet" : "We couldn't load verified numbers just now"}>
              <p>
                {result.state === "ok"
                  ? `MedTRANS has not yet verified an emergency number for ${site.pilot.country}, so we don't show one.`
                  : "This doesn't stop you getting help."}{" "}
                Call the emergency number you know for where you are, or go straight to the nearest hospital emergency department.
              </p>
            </Alert>
          )}
        </section>

        {staffed ? (
          <Alert tone="warning" title="MedTRANS does not send ambulances">
            <p>Our responders can call you back and help coordinate, but they are not a replacement for local emergency services. Don&apos;t wait for our call if life is at risk.</p>
          </Alert>
        ) : (
          <Alert tone="warning" title="MedTRANS is not an emergency service">
            <p>We cannot send an ambulance or emergency responders, and we do not monitor requests around the clock.</p>
          </Alert>
        )}

        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">When you call, say:</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-[0.95rem]">
            <li>Where you are — street, building, floor, gate and nearby landmarks.</li>
            <li>What happened, and when.</li>
            <li>Whether the person is awake, and whether they are breathing.</li>
            <li>How many people need help.</li>
            <li>The number you are calling from, in case you get cut off.</li>
          </ol>
          <p className="text-[0.95rem]">Stay on the line and follow the operator&apos;s instructions. Don&apos;t hang up until they tell you to.</p>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">Need your location?</h2>
          <p className="text-[0.95rem] text-muted">Your phone can show your coordinates so you can read them to the operator.</p>
          <ShareLocation />
        </Card>

        {staffed ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold">Want a MedTRANS responder to call you?</h2>
            <p className="text-[0.95rem] text-muted">Optional. Keep calling emergency services first if life is at risk. You&apos;ll see honestly whether a responder has seen your request.</p>
            <CallbackForm />
          </Card>
        ) : null}

        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">Not an emergency?</h2>
          <p className="text-[0.95rem] text-muted">
            For non-urgent care, a pharmacy or a home visit may be the right option.
          </p>
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary">
            <ArrowLeft aria-hidden className="size-4" />
            Back to ordinary care
          </Link>
        </Card>
      </div>
    </div>
  );
}
