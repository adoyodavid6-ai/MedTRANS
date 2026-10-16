import { ImageResponse } from "next/og";
import { site } from "@/lib/site/config";

export const alt = `${site.name} — ${site.promise}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#F6FAFA", color: "#0B2545" }}>
        <div style={{ fontSize: 88, fontWeight: 700, color: "#087F8C" }}>{site.name}</div>
        <div style={{ fontSize: 44, marginTop: 16 }}>{site.promise}</div>
        <div style={{ fontSize: 30, marginTop: 40, color: "#475569" }}>Verified pharmacies · Home visits by qualified clinicians · Emergency guidance</div>
      </div>
    ),
    size,
  );
}
