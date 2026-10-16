"use client";

import { useState, useTransition } from "react";
import { LocateFixed } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { checkCoverage, type CoverageResult } from "./actions";

const MODULE_LABELS: Record<string, string> = {
  pharmacy: "Pharmacy delivery",
  doctorcare: "DoctorCare home visits",
  emergency_guidance: "Local emergency guidance",
};

export function CoverageChecker() {
  const [result, setResult] = useState<CoverageResult | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);

  function run() {
    setGeoError(null);
    setResult(null);
    if (!("geolocation" in navigator)) {
      setGeoError("This device can't share its location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        startTransition(async () => {
          setResult(await checkCoverage({ lat: p.coords.latitude, lng: p.coords.longitude }));
        });
      },
      (e) => {
        setLocating(false);
        setGeoError(
          e.code === e.PERMISSION_DENIED
            ? "Location access was not allowed, so we can't check automatically."
            : "We couldn't get your location just now.",
        );
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  return (
    <div className="space-y-4">
      <Button type="button" size="lg" onClick={run} disabled={locating || pending}>
        <LocateFixed aria-hidden className="size-5" />
        {locating ? "Finding your location…" : pending ? "Checking…" : "Check my current location"}
      </Button>
      <p className="text-sm text-muted">We use your location once, for this check only. It is not stored.</p>

      <div aria-live="polite" className="space-y-3">
        {geoError ? (
          <Alert tone="warning" title={geoError}>
            <p>
              Checking by typed address needs a map provider, which isn&apos;t connected yet. Services are not active in any area
              yet, so nothing is missed.
            </p>
          </Alert>
        ) : null}
        {result?.state === "error" ? <Alert tone="warning" title={result.message} /> : null}
        {result?.state === "not_covered" ? (
          <Alert tone="info" title="MedTRANS isn't active where you are yet">
            <p>We open area by area, only once verified pharmacies and professionals are in place there.</p>
          </Alert>
        ) : null}
        {result?.state === "covered"
          ? result.areas.map((a) => (
              <Alert key={a.name} tone="success" title={`You're inside our ${a.name} service area`}>
                {a.modules.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {a.modules.map((m) => (
                      <li key={m}>{MODULE_LABELS[m] ?? m}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No services have been switched on here yet.</p>
                )}
              </Alert>
            ))
          : null}
      </div>
    </div>
  );
}
