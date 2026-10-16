import { Alert } from "@/components/ui/alert";

/** Shown on every legal page until qualified legal review signs off the final text. */
export function LegalDraftNotice({ token }: { token: string }) {
  return (
    <Alert tone="warning" title="Draft — awaiting legal review">
      <p>
        This page sets out the commitments MedTRANS is built around. It is not yet the final legal text, which will be published
        after review by qualified lawyers for each country we operate in.
      </p>
      {process.env.NODE_ENV !== "production" ? <code className="text-xs">{token}</code> : null}
    </Alert>
  );
}
