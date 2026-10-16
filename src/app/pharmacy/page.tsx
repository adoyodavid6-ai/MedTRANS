import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Search, ShieldCheck, Truck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";

export const metadata: Metadata = {
  title: "MedTRANS Pharmacy",
  description: "Medicines from verified, licensed pharmacies, checked by a pharmacist and delivered.",
  alternates: { canonical: "/pharmacy" },
};

export default function PharmacyPage() {
  return (
    <>
      <PageHeader eyebrow="MedTRANS Pharmacy" title="Medicines from verified pharmacies, delivered"
        intro="Search by medicine name, generic name or brand. Prescription-only medicines are always labelled, and a licensed pharmacist checks your prescription before anything is dispensed.">
        <form action="/pharmacy/medicines" role="search" className="mt-6 flex max-w-xl gap-2">
          <label htmlFor="q" className="sr-only">Search medicines</label>
          <Input id="q" name="q" placeholder="e.g. paracetamol" autoComplete="off" />
          <Button type="submit"><Search aria-hidden className="size-4" />Search</Button>
        </form>
      </PageHeader>
      <div className="container-page grid gap-4 py-10 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Verified pharmacies only", body: "Only pharmacies with a licence we have checked, and a verified pharmacist on staff, can take your order." },
          { icon: ClipboardCheck, title: "Pharmacist-checked prescriptions", body: "Upload your prescription; a pharmacist reviews it before you pay. Nothing prescription-only is dispensed without approval." },
          { icon: Truck, title: "Honest delivery tracking", body: "Every step on your order timeline is something that actually happened. Your handover code confirms delivery." },
        ].map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <Icon aria-hidden className="size-7 text-primary" />
            <h2 className="mt-3 text-lg font-semibold">{title}</h2>
            <p className="mt-1.5 text-[0.95rem] text-muted">{body}</p>
          </Card>
        ))}
      </div>
      <div className="container-page flex flex-wrap gap-4 pb-6">
        <Link href="/pharmacy/medicines" className="font-semibold text-primary underline">Browse all medicines</Link>
        <Link href="/pharmacies" className="font-semibold text-primary underline">See pharmacies</Link>
      </div>
    </>
  );
}
