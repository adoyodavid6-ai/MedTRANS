import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Opens a prescription file through a 60-second signed link. Access is checked and audited
 * in the database (prescription_file_path); storage policies enforce it a second time.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new NextResponse("Not found", { status: 404 });
  const user = await getSessionUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });

  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("prescription_file_path", { p_prescription: id.data });
  if (error || !path) return new NextResponse("Not found", { status: 404 });
  const { data: signed, error: signError } = await supabase.storage.from("prescriptions").createSignedUrl(path as string, 60);
  if (signError || !signed) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
