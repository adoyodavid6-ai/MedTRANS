import { describe, expect, it } from "vitest";
import { parseSavedLocation } from "@/lib/location/store";

describe("parseSavedLocation", () => {
  it("accepts a manual location", () => {
    expect(parseSavedLocation(JSON.stringify({ label: "Westlands", source: "manual" }))).toEqual({ label: "Westlands", source: "manual" });
  });
  it("keeps valid coordinates only", () => {
    expect(parseSavedLocation(JSON.stringify({ label: "x", source: "device", lat: -1.28, lng: 36.82, accuracyM: 20 }))).toEqual({
      label: "x", source: "device", lat: -1.28, lng: 36.82, accuracyM: 20,
    });
    expect(parseSavedLocation(JSON.stringify({ label: "x", source: "device", lat: 200, lng: 36.82 }))).toEqual({ label: "x", source: "device" });
  });
  it("rejects tampered or broken data", () => {
    expect(parseSavedLocation("{not json")).toBeNull();
    expect(parseSavedLocation(JSON.stringify({ label: 1, source: "manual" }))).toBeNull();
    expect(parseSavedLocation(JSON.stringify({ label: "x", source: "gps" }))).toBeNull();
    expect(parseSavedLocation(null)).toBeNull();
  });
});
