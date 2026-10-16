import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only routes that use a session. Public pages stay static and cacheable.
  matcher: ["/account/:path*", "/portal/:path*", "/ops/:path*", "/sign-in", "/welcome"],
};
