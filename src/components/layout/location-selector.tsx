"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { LocateFixed, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  clearSavedLocation,
  readSavedLocation,
  saveLocation,
  subscribeLocation,
  type SavedLocation,
} from "@/lib/location/store";

/**
 * Header location selector (§6B, §9A).
 * - Device location is requested only after an explicit tap, never on page load.
 * - Denial never blocks anything: typing an area always works.
 * - The choice stays on this device (localStorage) and is not sent anywhere until a feature needs it.
 */
export function LocationSelector({ className }: { className?: string }) {
  const location = useSyncExternalStore(subscribeLocation, readSavedLocation, () => null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={cn(
          "inline-flex min-h-11 max-w-56 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-navy hover:border-primary",
          className,
        )}
        aria-haspopup="dialog"
      >
        <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
        <span className="truncate">{location ? location.label : "Set your location"}</span>
      </button>
      <LocationDialog dialogRef={dialogRef} current={location} />
    </>
  );
}

function LocationDialog({
  dialogRef,
  current,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  current: SavedLocation | null;
}) {
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const uid = useId();
  const titleId = `${uid}-title`;
  const inputId = `${uid}-manual`;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onClose = () => setStatus(null);
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, [dialogRef]);

  function useDevice() {
    if (!("geolocation" in navigator)) {
      setStatus({ tone: "error", text: "This device can't share its location. Type your area instead." });
      return;
    }
    setLocating(true);
    setStatus({ tone: "info", text: "Asking your device for its location…" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        saveLocation({
          label: "Current location",
          source: "device",
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          accuracyM: Math.round(pos.coords.accuracy),
        });
        dialogRef.current?.close();
      },
      (err) => {
        setLocating(false);
        setStatus({
          tone: "error",
          text:
            err.code === err.PERMISSION_DENIED
              ? "Location access was not allowed. That's fine — type your area, estate or a landmark instead."
              : "We couldn't get your location just now. Type your area, estate or a landmark instead.",
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  function useManual(e: React.FormEvent) {
    e.preventDefault();
    const label = manual.trim();
    if (label.length < 2) {
      setStatus({ tone: "error", text: "Enter your area, estate, street or a nearby landmark." });
      return;
    }
    saveLocation({ label: label.slice(0, 80), source: "manual" });
    setManual("");
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-navy/40"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line p-5">
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            Where do you need care?
          </h2>
          <p className="mt-1 text-sm text-muted">Enter your location or allow location access.</p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-primary-soft"
        >
          <X aria-hidden className="size-5" />
          <span className="sr-only">Close</span>
        </button>
      </div>

      <div className="space-y-5 p-5">
        <Button type="button" variant="secondary" className="w-full" onClick={useDevice} disabled={locating}>
          <LocateFixed aria-hidden className="size-4" />
          {locating ? "Locating…" : "Use my current location"}
        </Button>

        <form onSubmit={useManual} className="space-y-3" noValidate>
          <Field id={inputId} label="Or type your area" hint="For example: estate, street, building or a landmark nearby.">
            <Input
              id={inputId}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              autoComplete="address-level3"
              maxLength={80}
              aria-describedby={`${inputId}-hint`}
            />
          </Field>
          <Button type="submit" className="w-full">
            Use this location
          </Button>
        </form>

        <p role="status" aria-live="polite" className={cn("text-sm", status?.tone === "error" ? "text-urgent" : "text-muted")}>
          {status?.text}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
          <Link href="/coverage" className="font-semibold text-primary underline underline-offset-2" onClick={() => dialogRef.current?.close()}>
            Check if we cover your area
          </Link>
          {current ? (
            <button type="button" className="min-h-11 text-muted underline underline-offset-2" onClick={() => clearSavedLocation()}>
              Forget saved location
            </button>
          ) : null}
        </div>
        <p className="text-xs text-muted">Your location stays on this device until you use a service that needs it.</p>
      </div>
    </dialog>
  );
}
