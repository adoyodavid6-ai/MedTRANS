"use client";

import { useEffect } from "react";
import { track, type TrackedEvent } from "@/lib/analytics/track";

/** Counts one anonymous view per page load. Sends only the event name and a public path. */
export function TrackView({ event, path }: { event: TrackedEvent; path: string }) {
  useEffect(() => {
    void track(event, path);
  }, [event, path]);
  return null;
}
