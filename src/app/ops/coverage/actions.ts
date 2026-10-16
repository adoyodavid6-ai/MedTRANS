"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const done = (ok: string): FormState => {
  revalidatePath("/ops/coverage");
  revalidatePath("/coverage");
  return { ok };
};

const CountryInput = z.object({
  code: z.string().regex(/^[A-Z]{2}$/),
  op: z.enum(["activate", "deactivate"]),
  review_ref: z.string().trim().max(200).optional(),
  confirm: z.literal("yes"),
});

export async function setCountryActive(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/coverage", ["admin"]);
  const p = CountryInput.safeParse({
    code: formData.get("code"),
    op: formData.get("op"),
    review_ref: (formData.get("review_ref") as string) || undefined,
    confirm: formData.get("confirm"),
  });
  if (!p.success) return { error: "Tick the confirmation box to continue." };
  const supabase = await createClient();
  if (p.data.op === "activate") {
    if (!p.data.review_ref) return { error: "Record the regulatory review reference before activating a country." };
    const { error } = await supabase
      .from("countries")
      .update({ is_active: true, regulatory_review_ref: p.data.review_ref, regulatory_reviewed_at: new Date().toISOString() })
      .eq("code", p.data.code);
    return error ? { error: "Not saved." } : done("Country activated.");
  }
  const { error } = await supabase.from("countries").update({ is_active: false }).eq("code", p.data.code);
  return error ? { error: "Not saved." } : done("Country deactivated.");
}

const BoundaryInput = z.object({ area: z.uuid(), geojson: z.string().max(500_000) });

export async function setBoundary(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/coverage", ["admin"]);
  const p = BoundaryInput.safeParse({ area: formData.get("area"), geojson: formData.get("geojson") ?? "" });
  if (!p.success) return { error: "Boundary is too large or the area is unknown." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_area_boundary", { area: p.data.area, geojson: p.data.geojson });
  if (error) return { error: error.code === "22023" ? error.message.replace(/^.*?: /, "") : "Boundary not saved." };
  return done(p.data.geojson.trim() ? "Boundary saved." : "Boundary cleared and area deactivated.");
}

const AreaToggle = z.object({ area: z.uuid(), active: z.enum(["true", "false"]), confirm: z.literal("yes") });

export async function setAreaActive(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/coverage", ["admin"]);
  const p = AreaToggle.safeParse({ area: formData.get("area"), active: formData.get("active"), confirm: formData.get("confirm") });
  if (!p.success) return { error: "Tick the confirmation box to continue." };
  const supabase = await createClient();
  const { error } = await supabase.from("service_coverage_areas").update({ is_active: p.data.active === "true" }).eq("id", p.data.area);
  if (error) return { error: error.code === "23514" ? "An area needs a boundary before it can be activated." : "Not saved." };
  return done(p.data.active === "true" ? "Area activated." : "Area deactivated.");
}

const ModuleToggle = z.object({
  area: z.uuid(),
  module: z.enum(["pharmacy", "doctorcare", "emergency_guidance"]),
  active: z.enum(["true", "false"]),
});

export async function setModuleActive(formData: FormData) {
  await requireAccount("/ops/coverage", ["admin"]);
  const p = ModuleToggle.safeParse({ area: formData.get("area"), module: formData.get("module"), active: formData.get("active") });
  if (!p.success) return;
  const on = p.data.active === "true";
  const supabase = await createClient();
  await supabase
    .from("coverage_area_services")
    .update({ is_active: on, activated_at: on ? new Date().toISOString() : null })
    .eq("area_id", p.data.area)
    .eq("module", p.data.module);
  revalidatePath("/ops/coverage");
}
