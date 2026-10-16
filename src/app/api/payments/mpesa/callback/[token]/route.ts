import { handleMpesaCallback } from "@/lib/payments/mpesa";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const raw = await request.text();
  const { status, outcome } = await handleMpesaCallback(token, raw);
  // Daraja expects a JSON acknowledgement.
  return Response.json({ ResultCode: status === 200 ? 0 : 1, ResultDesc: outcome }, { status });
}
