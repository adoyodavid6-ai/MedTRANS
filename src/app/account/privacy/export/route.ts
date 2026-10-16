import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { buildExport } from "@/lib/privacy/export";
import { createClient } from "@/lib/supabase/server";

// Self-service copy of your data (right of access). POST so it can't be triggered by a link or prefetch.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_data_export");
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Export failed." }, { status: error.code === "P0001" ? 429 : 500 });
  let body: unknown;
  try {
    body = await buildExport(supabase, user.id);
  } catch {
    return NextResponse.json({ error: "Export failed. Please try again or contact us." }, { status: 500 });
  }
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="medtrans-my-data-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
