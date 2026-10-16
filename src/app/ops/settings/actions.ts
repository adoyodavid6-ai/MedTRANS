"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const Announcement = z.object({
  enabled: z.literal("on").optional(),
  message: z.string().trim().max(200, "Keep it under 200 characters.").optional(),
  href: z
    .string()
    .trim()
    .regex(/^\/(?!\/)[^\s]*$/, "Use a MedTRANS path starting with /, e.g. /coverage.")
    .optional(),
});

export async function saveAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/ops/settings", ["admin"]);
  const names = ["enabled", "message", "href"];
  const values = submittedValues(formData, names);
  const p = Announcement.safeParse(formFields(formData, names));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values };
  if (p.data.enabled && !p.data.message) return { fieldErrors: { message: "Enter a message to show." }, values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({
      value: { enabled: Boolean(p.data.enabled), message: p.data.message ?? null, href: p.data.href ?? null },
      updated_by: user.id,
    })
    .eq("key", "announcement");
  if (error) return { error: "Not saved." };
  revalidatePath("/", "layout");
  return { ok: "Announcement saved. Public pages update within five minutes.", values };
}
