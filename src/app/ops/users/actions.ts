"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROLES } from "@/lib/auth/roles";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const Input = z.object({ user_id: z.uuid(), role: z.enum(ROLES), op: z.enum(["grant", "revoke"]), confirm: z.literal("yes") });

export type RoleChangeResult = { ok?: string; error?: string };

export async function changeRole(_prev: RoleChangeResult, formData: FormData): Promise<RoleChangeResult> {
  await requireAccount("/ops/users", ["admin"]);
  const parsed = Input.safeParse({
    user_id: formData.get("user_id"),
    role: formData.get("role"),
    op: formData.get("op"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: "Choose a role and tick the confirmation box." };

  const supabase = await createClient();
  const fn = parsed.data.op === "grant" ? "admin_grant_role" : "admin_revoke_role";
  const { error } = await supabase.rpc(fn, { target: parsed.data.user_id, r: parsed.data.role });
  if (error) {
    return { error: error.message.includes("last administrator") ? "You can't remove the last administrator." : "The change was not saved." };
  }
  revalidatePath("/ops/users");
  return { ok: parsed.data.op === "grant" ? "Role granted." : "Role revoked." };
}
