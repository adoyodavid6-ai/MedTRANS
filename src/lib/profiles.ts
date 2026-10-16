import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Display names for user ids the caller is allowed to read (RLS applies). */
export async function namesFor(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? "Unnamed"]));
}
