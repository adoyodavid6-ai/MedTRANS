import { ButtonLink } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <div className="container-page max-w-xl py-16 text-center">
      <p className="text-sm font-semibold text-primary">403</p>
      <h1 className="mt-2 text-3xl font-medium">You don&apos;t have access to this area</h1>
      <p className="mt-3 text-muted">This part of MedTRANS is limited to specific roles. If you think you should have access, contact an administrator.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/account">Go to my account</ButtonLink>
        <ButtonLink href="/" variant="secondary">Homepage</ButtonLink>
      </div>
    </div>
  );
}
