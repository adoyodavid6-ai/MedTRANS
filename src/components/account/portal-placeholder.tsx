import type { LucideIcon } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Role portal before its module opens. Shows the honest verification state (always "not verified"
 * until the onboarding & credential checks of that module exist) and what will appear here.
 */
export function PortalPlaceholder({
  intro,
  verificationNote,
  sections,
}: {
  intro: string;
  verificationNote: string;
  sections: { icon: LucideIcon; title: string; body: string }[];
}) {
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">Verification</h2>
          <VerificationBadge status="unverified" />
        </div>
        <p className="mt-2 text-[0.95rem] text-muted">{verificationNote}</p>
      </Card>
      <Alert tone="info" title="Not yet activated">
        <p>{intro}</p>
      </Alert>
      <div className="grid gap-3 md:grid-cols-2">
        {sections.map((s) => (
          <EmptyState key={s.title} icon={s.icon} title={s.title}>
            {s.body}
          </EmptyState>
        ))}
      </div>
    </>
  );
}
