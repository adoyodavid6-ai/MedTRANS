"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { LocateFixed } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { findNear, type NearResult } from "./actions";

export function NearList() {
  const [result, setResult] = useState<NearResult | null>(null);
  const [geo, setGeo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function locate() {
    setGeo(null);
    if (!("geolocation" in navigator)) return setGeo("This device can't share its location.");
    navigator.geolocation.getCurrentPosition(
      (p) => start(async () => setResult(await findNear({ lat: p.coords.latitude, lng: p.coords.longitude }))),
      () => setGeo("Location wasn't shared. You can still request a visit using a saved address."),
      { timeout: 15000, maximumAge: 300000 },
    );
  }

  return (
    <div className="space-y-4">
      <Button size="lg" onClick={locate} disabled={pending}><LocateFixed aria-hidden className="size-5" />{pending ? "Searching…" : "Use my current location"}</Button>
      <p className="text-sm text-muted">Your location is used once for this search and not stored.</p>
      <div aria-live="polite" className="space-y-3">
        {geo ? <Alert tone="warning" title={geo}><p><Link href="/doctorcare/book" className="font-semibold underline">Request a home visit</Link></p></Alert> : null}
        {result && !result.ok ? <Alert tone="warning" title={result.message} /> : null}
        {result?.ok && result.providers.length === 0 ? (
          <Alert tone="info" title="No verified professional covers this location right now">
            <p>DoctorCare opens area by area. You can check again later, or contact support.</p>
          </Alert>
        ) : null}
        {result?.ok && result.providers.length > 0 ? (
          <>
            <p className="text-sm text-muted">Distances are approximate and straight-line, not travel time.</p>
            <ul className="space-y-3">
              {result.providers.map((p) => (
                <li key={p.provider_id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <Link href={`/providers/${p.provider_id}`} className="font-semibold text-navy underline">{p.display_name}</Link>
                      <p className="text-sm text-muted">{p.profession === "doctor" ? "Doctor" : "Nurse"} · about {p.distance_km} km away</p>
                      <p className="text-sm">{p.services.map((s) => `${s.name} (${formatMoney(s.fee_minor)})`).join(", ")}</p>
                    </div>
                    <Link href="/doctorcare/book" className="font-semibold text-primary underline">Request a visit</Link>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
