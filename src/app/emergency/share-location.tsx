"use client";

import { useState } from "react";
import { Copy, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";

type State =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "found"; lat: number; lng: number; accuracy: number }
  | { kind: "error"; message: string };

/**
 * Shows the device's coordinates so the caller can read them to an emergency operator.
 * Nothing is sent to MedTRANS or anyone else: this is entirely on the device.
 */
export function ShareLocation() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  function locate() {
    if (!("geolocation" in navigator)) {
      setState({ kind: "error", message: "This device can't share its location. Describe where you are: street, building, landmarks." });
      return;
    }
    setState({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      (p) => setState({ kind: "found", lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) =>
        setState({
          kind: "error",
          message:
            e.code === e.PERMISSION_DENIED
              ? "Location access was not allowed. Describe where you are instead: street, building, gate and nearby landmarks."
              : "We couldn't get your location. Describe where you are instead: street, building, gate and nearby landmarks.",
        }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  const text = state.kind === "found" ? `${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}` : "";

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" onClick={locate} disabled={state.kind === "locating"} className="w-full sm:w-auto">
        <LocateFixed aria-hidden className="size-4" />
        {state.kind === "locating" ? "Finding your location…" : "Show my location to read out"}
      </Button>
      <div role="status" aria-live="polite">
        {state.kind === "found" ? (
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-sm text-muted">Your coordinates (latitude, longitude):</p>
            <p className="mt-1 font-mono text-xl font-semibold text-navy">{text}</p>
            <p className="mt-1 text-sm text-muted">Accurate to about {state.accuracy} metres. Also describe nearby landmarks.</p>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 -ml-2"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              <Copy aria-hidden className="size-4" />
              {copied ? "Copied" : "Copy coordinates"}
            </Button>
          </div>
        ) : null}
        {state.kind === "error" ? <p className="text-[0.95rem] text-urgent">{state.message}</p> : null}
      </div>
      <p className="text-xs text-muted">Your location is not sent to MedTRANS. It is shown only on this screen.</p>
    </div>
  );
}
