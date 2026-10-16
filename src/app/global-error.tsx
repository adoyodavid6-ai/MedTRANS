"use client";

// Last-resort error page. Kept dependency-free so it renders even if the app shell fails.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", color: "#202B33", background: "#FAFCFB" }}>
        <h1 style={{ color: "#153047" }}>MedTRANS is having trouble</h1>
        <p>Please try again. If someone&apos;s life may be at risk, contact local emergency services now.</p>
        <p>
          <button onClick={() => reset()} style={{ minHeight: 44, padding: "0 16px" }}>Try again</button>{" "}
          <a href="/emergency" style={{ color: "#C62828", fontWeight: 600 }}>Emergency Help</a>
        </p>
      </body>
    </html>
  );
}
