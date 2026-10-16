import type { Instrumentation } from "next";
import { redactMessage, redactPath } from "@/lib/monitoring/redact";

/**
 * Server error reporting. Always writes one structured log line (picked up by the host's log drain).
 * If ERROR_REPORT_URL is set, also POSTs the same redacted record there (e.g. a Sentry/Better Stack
 * ingestion endpoint or an internal webhook). Headers, cookies, bodies and query strings are never sent.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const record = {
    level: "error",
    at: new Date().toISOString(),
    message: redactMessage(err instanceof Error ? err.message : String(err)),
    digest: typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined,
    method: request.method,
    path: redactPath(request.path),
    route: context.routePath,
    routeType: context.routeType,
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RELEASE ?? "local",
  };
  console.error(JSON.stringify(record));
  const url = process.env.ERROR_REPORT_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.ERROR_REPORT_TOKEN ? { Authorization: `Bearer ${process.env.ERROR_REPORT_TOKEN}` } : {}) },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Reporting must never break the request.
  }
};
