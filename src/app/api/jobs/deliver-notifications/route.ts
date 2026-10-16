import { timingSafeEqual } from "node:crypto";
import { deliverPending } from "@/lib/notifications/deliver";

/** Scheduled job (e.g. Vercel Cron every minute). Requires Authorization: Bearer CRON_SECRET. [[ENV: CRON_SECRET]] */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response("Unauthorised", { status: 401 });
  }
  return Response.json(await deliverPending());
}
export const GET = POST;
