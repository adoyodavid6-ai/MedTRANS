import Link from "next/link";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LANGUAGES } from "@/lib/doctorcare/status";
import { formatMoney } from "@/lib/money";

export type DirectoryProvider = {
  provider_id: string; display_name: string; profession: string; bio: string | null; languages: string[]; years_experience: number | null;
  regulator: string; registration_number: string; verified_at: string; accepts_bookings: boolean; services: { slug: string; name: string; fee_minor: number }[];
};

export function ProviderCard({ p }: { p: DirectoryProvider }) {
  return (
    <Card className="space-y-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/providers/${p.provider_id}`} className="text-lg font-semibold text-navy underline-offset-2 hover:underline">{p.display_name}</Link>
        <VerificationBadge status="verified" />
        {p.accepts_bookings ? <Badge tone="primary">Taking bookings</Badge> : <Badge>Not taking bookings</Badge>}
      </div>
      <p className="text-sm text-muted">
        {p.profession === "doctor" ? "Doctor" : "Nurse"} · {p.regulator} registration {p.registration_number}
        {p.years_experience ? ` · ${p.years_experience} years' experience` : ""}
      </p>
      <p className="text-sm">Speaks {p.languages.map((l) => LANGUAGES[l] ?? l).join(", ")}</p>
      {p.services.length ? <ul className="text-sm">{p.services.map((s) => <li key={s.slug}>{s.name}: {formatMoney(s.fee_minor)}</li>)}</ul> : null}
    </Card>
  );
}
