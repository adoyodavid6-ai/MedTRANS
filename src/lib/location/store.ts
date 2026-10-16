// Device-local location preference. Never sent to the server by this module.

export type SavedLocation = {
  label: string;
  source: "device" | "manual";
  lat?: number;
  lng?: number;
  accuracyM?: number;
};

const KEY = "medtrans.location";
const EVENT = "medtrans:location";

let cachedRaw: string | null | undefined;
let cachedValue: SavedLocation | null = null;

export function parseSavedLocation(raw: string | null): SavedLocation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SavedLocation>;
    if (typeof v.label !== "string" || (v.source !== "device" && v.source !== "manual")) return null;
    const out: SavedLocation = { label: v.label.slice(0, 80), source: v.source };
    if (typeof v.lat === "number" && typeof v.lng === "number" && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180) {
      out.lat = v.lat;
      out.lng = v.lng;
      if (typeof v.accuracyM === "number") out.accuracyM = v.accuracyM;
    }
    return out;
  } catch {
    return null;
  }
}

export function readSavedLocation(): SavedLocation | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseSavedLocation(raw);
  }
  return cachedValue;
}

export function saveLocation(loc: SavedLocation) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(loc));
  } catch {
    // Storage unavailable (private mode): the choice simply isn't remembered.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function clearSavedLocation() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeLocation(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
