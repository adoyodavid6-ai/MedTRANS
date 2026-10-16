import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProviderCard, type DirectoryProvider } from "@/components/doctorcare/provider-card";
import { ButtonLink } from "@/components/ui/button";
import { createAnonClient } from "@/lib/supabase/server";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data } = await createAnonClient().rpc("provider_directory");
  return ((data ?? []) as DirectoryProvider[]).find((p) => p.provider_id === id) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await load((await params).id);
  return p ? { title: p.display_name, alternates: { canonical: `/providers/${p.provider_id}` } } : { title: "Not found" };
}

export default async function ProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id);
  if (!p) notFound();
  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <h1 className="text-3xl font-bold">{p.display_name}</h1>
      <ProviderCard p={p} />
      {p.bio ? <p className="text-[0.95rem]">{p.bio}</p> : null}
      <p className="text-sm text-muted">Registration checked by MedTRANS on {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(p.verified_at))}.</p>
      {p.accepts_bookings ? <ButtonLink href="/doctorcare/book">Request a home visit</ButtonLink> : null}
    </div>
  );
}
