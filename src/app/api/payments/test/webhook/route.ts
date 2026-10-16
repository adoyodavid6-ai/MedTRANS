import { handleTestWebhook } from "@/lib/payments/test-gateway";

export async function POST(request: Request) {
  const raw = await request.text();
  const { status, outcome } = await handleTestWebhook(raw, request.headers.get("x-test-signature"), request.headers.get("x-test-timestamp"));
  return Response.json({ outcome }, { status });
}
