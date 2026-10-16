"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const ADMIN = ["admin"] as const;
const msg = (e: { code?: string; message: string } | null) => (e ? (["P0001", "22023", "23514"].includes(e.code ?? "") ? e.message : "Not saved.") : undefined);

export async function generateSettlements(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/settlements", ADMIN);
  const p = z.object({ start: z.iso.date(), end: z.iso.date() }).safeParse({ start: formData.get("start"), end: formData.get("end") });
  if (!p.success) return { error: "Choose a start and end date." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_generate_settlements", { p_start: p.data.start, p_end: p.data.end });
  revalidatePath("/ops/settlements");
  return error ? { error: msg(error) } : { ok: `${data} draft settlement${data === 1 ? "" : "s"} created.` };
}

export async function settlementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/settlements", ADMIN);
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Unknown settlement." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_settlement_action", { p_settlement: id.data, p_action: String(formData.get("action")), p_reference: (formData.get("reference") as string) || null });
  revalidatePath("/ops/settlements");
  return error ? { error: msg(error) } : { ok: "Done." };
}

export async function reviewApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/ops/applications", ADMIN);
  const p = z.object({ id: z.uuid(), status: z.enum(["received", "in_review", "approved", "declined"]), note: z.string().trim().max(1000).optional() })
    .safeParse({ id: formData.get("id"), status: formData.get("status"), note: (formData.get("note") as string) || undefined });
  if (!p.success) return { error: "Check the details." };
  const supabase = await createClient();
  const { error } = await supabase.from("partner_applications").update({ status: p.data.status, review_note: p.data.note ?? null, reviewed_by: user.id }).eq("id", p.data.id);
  revalidatePath("/ops/applications");
  return error ? { error: "Not saved." } : { ok: "Saved." };
}

const Article = z.object({
  id: z.uuid().optional(),
  title: z.string({ error: "Enter a title." }).trim().min(5).max(160),
  summary: z.string({ error: "Enter a summary." }).trim().min(10).max(300),
  body: z.string({ error: "Write the article." }).trim().min(50, "The article is too short.").max(20000),
  reviewed_by_name: z.string().trim().max(120).optional(),
  reviewed_by_credentials: z.string().trim().max(160).optional(),
  reviewed_at: z.iso.date().optional(),
  publish: z.enum(["on"]).optional(),
});

export async function saveArticle(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/articles", ADMIN);
  const names = ["id", "title", "summary", "body", "reviewed_by_name", "reviewed_by_credentials", "reviewed_at", "publish"];
  const p = Article.safeParse(formFields(formData, names));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values: submittedValues(formData, names) };
  if (p.data.publish && !(p.data.reviewed_by_name && p.data.reviewed_by_credentials && p.data.reviewed_at)) {
    return { error: "To publish, record the reviewing clinician, their credentials and the review date.", values: submittedValues(formData, names) };
  }
  const row = {
    title: p.data.title, summary: p.data.summary, body: p.data.body,
    reviewed_by_name: p.data.reviewed_by_name ?? null, reviewed_by_credentials: p.data.reviewed_by_credentials ?? null,
    reviewed_at: p.data.reviewed_at ?? null, is_published: Boolean(p.data.publish),
    next_review_due: p.data.reviewed_at ? new Date(new Date(p.data.reviewed_at).getTime() + 365 * 864e5).toISOString().slice(0, 10) : null,
  };
  const supabase = await createClient();
  let slug = p.data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "");
  if (!p.data.id) {
    const { data: taken } = await supabase.from("articles").select("slug").like("slug", `${slug}%`);
    const used = new Set((taken ?? []).map((t) => t.slug));
    for (let n = 2; used.has(slug); n++) slug = `${slug.replace(/-\d+$/, "")}-${n}`;
  }
  const { error } = p.data.id
    ? await supabase.from("articles").update(row).eq("id", p.data.id)
    : await supabase.from("articles").insert({ ...row, slug });
  revalidatePath("/ops/articles");
  revalidatePath("/resources");
  return error ? { error: msg(error) ?? "Not saved.", values: submittedValues(formData, names) } : { ok: row.is_published ? "Saved and published." : "Saved as draft." };
}

const Plan = z.object({
  audience: z.enum(["pharmacy", "provider", "organisation"]),
  name: z.string({ error: "Name the plan." }).trim().min(2).max(80),
  summary: z.string({ error: "Summarise the plan." }).trim().min(5).max(300),
  features: z.string().trim().max(2000).optional(),
  price: z.coerce.number().min(0).max(10_000_000).optional(),
  billing_period: z.enum(["month", "year"]).optional(),
});

export async function createPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/plans", ADMIN);
  const names = ["audience", "name", "summary", "features", "price", "billing_period"];
  const p = Plan.safeParse(formFields(formData, names));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values: submittedValues(formData, names) };
  const supabase = await createClient();
  const { error } = await supabase.from("subscription_plans").insert({
    audience: p.data.audience, name: p.data.name, summary: p.data.summary,
    features: (p.data.features ?? "").split("\n").map((f) => f.trim()).filter(Boolean),
    price_minor: p.data.price !== undefined ? Math.round(p.data.price * 100) : null, billing_period: p.data.billing_period ?? null,
  });
  revalidatePath("/ops/plans");
  return error ? { error: "Not saved." } : { ok: "Plan saved (inactive)." };
}

export async function togglePlan(formData: FormData) {
  await requireAccount("/ops/plans", ADMIN);
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("subscription_plans").update({ is_active: formData.get("active") === "true" }).eq("id", id.data);
  revalidatePath("/ops/plans");
  revalidatePath("/partnerships");
}
