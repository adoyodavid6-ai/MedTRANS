"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["doctor", "nurse"] as const;
const msg = (e: { code?: string; message: string } | null, fallback = "Not saved.") =>
  e ? (["P0001", "22023", "42501", "23514"].includes(e.code ?? "") ? e.message : fallback) : undefined;

export async function respondOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/portal/care", ROLES);
  const id = z.uuid().safeParse(formData.get("offer_id"));
  if (!id.success) return { error: "Unknown request." };
  const accept = formData.get("op") === "accept";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_to_offer", { p_offer: id.data, p_accept: accept, p_reason: (formData.get("reason") as string) || null });
  if (error) return { error: msg(error) };
  revalidatePath("/portal/care");
  const result: Record<string, string> = {
    accepted: "Accepted. The patient has been asked to pay to confirm.", declined: "Declined. We'll ask the next suitable professional.",
    expired: "This request has expired.", no_longer_needed: "This request is no longer needed.", not_eligible: "You're no longer free or eligible for this time.",
    fee_mismatch: "Your fee is above what the patient agreed.", clash: "This clashes with another of your visits.",
  };
  return data === "accepted" || data === "declined" ? { ok: result[data as string] } : { error: result[data as string] ?? "Not saved." };
}

const Move = z.object({ booking_id: z.uuid(), to: z.enum(["en_route", "arrived", "in_progress", "no_show", "refund_processing"]), note: z.string().trim().max(500).optional() });

export async function moveVisit(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/portal/care/visits", ROLES);
  const p = Move.safeParse({ booking_id: formData.get("booking_id"), to: formData.get("to"), note: (formData.get("note") as string) || undefined });
  if (!p.success) return { error: "Unknown action." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_booking", { p_booking: p.data.booking_id, p_to: p.data.to, p_note: p.data.note ?? null });
  revalidatePath("/portal/care/visits");
  return error ? { error: msg(error) } : { ok: "Updated." };
}

const VisitRecord = z.object({
  booking_id: z.uuid(),
  presenting_concern: z.string({ error: "Record the reason for the visit." }).trim().min(2).max(2000),
  care_provided: z.string({ error: "Record the care you provided." }).trim().min(2).max(4000),
  observations: z.string().trim().max(4000).optional(),
  advice: z.string().trim().max(4000).optional(),
  follow_up: z.string().trim().max(2000).optional(),
  referral: z.string().trim().max(2000).optional(),
});

export async function completeVisit(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/portal/care/visits", ROLES);
  const get = (k: string) => (formData.get(k) as string) || undefined;
  const p = VisitRecord.safeParse({ booking_id: get("booking_id"), presenting_concern: get("presenting_concern"), care_provided: get("care_provided"), observations: get("observations"), advice: get("advice"), follow_up: get("follow_up"), referral: get("referral") });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Complete the record." };
  const vitals: Record<string, string> = {};
  for (const k of ["temperature_c", "pulse_bpm", "blood_pressure", "respiratory_rate", "oxygen_saturation_pct"]) {
    const v = String(formData.get(k) ?? "").trim().slice(0, 20);
    if (v) vitals[k] = v;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_visit", {
    p_booking: p.data.booking_id, p_presenting_concern: p.data.presenting_concern, p_care_provided: p.data.care_provided,
    p_observations: p.data.observations ?? null, p_vitals: vitals, p_advice: p.data.advice ?? null, p_follow_up: p.data.follow_up ?? null, p_referral: p.data.referral ?? null,
  });
  revalidatePath("/portal/care/visits");
  return error ? { error: msg(error) } : { ok: "Visit completed and signed." };
}

const Profile = z.object({
  bio: z.string().trim().max(1000).optional(),
  service_radius_km: z.coerce.number().min(0.5).max(50),
  travel_buffer_minutes: z.coerce.number().int().min(0).max(180),
  accepts_bookings: z.enum(["on"]).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/portal/care/profile", ROLES);
  const get = (k: string) => (formData.get(k) as string) || undefined;
  const p = Profile.safeParse({ bio: get("bio"), service_radius_km: get("service_radius_km"), travel_buffer_minutes: get("travel_buffer_minutes"), accepts_bookings: get("accepts_bookings"), lat: get("lat"), lng: get("lng") });
  if (!p.success) return { error: "Check the travel radius (0.5–50 km) and buffer (0–180 minutes)." };
  const languages = formData.getAll("languages").map(String).filter((l) => ["en", "sw", "so", "fr", "ar"].includes(l));
  const update: Record<string, unknown> = {
    bio: p.data.bio ?? null, service_radius_m: Math.round(p.data.service_radius_km * 1000), travel_buffer_minutes: p.data.travel_buffer_minutes,
    accepts_bookings: Boolean(p.data.accepts_bookings), languages: languages.length ? languages : ["en"],
  };
  if (p.data.lat !== undefined && p.data.lng !== undefined) update.base_location = `SRID=4326;POINT(${p.data.lng} ${p.data.lat})`;
  const supabase = await createClient();
  const { error } = await supabase.from("provider_profiles").update(update).eq("user_id", user.id);
  revalidatePath("/portal/care/profile");
  return error ? { error: msg(error) } : { ok: "Saved." };
}

export async function saveServices(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/portal/care/profile", ROLES);
  const supabase = await createClient();
  const ids = formData.getAll("service_id").map(String);
  for (const id of ids) {
    if (!z.uuid().safeParse(id).success) continue;
    const offered = formData.get(`offered:${id}`) === "on";
    const fee = Number(formData.get(`fee:${id}`));
    if (offered) {
      if (!Number.isFinite(fee) || fee <= 0 || fee > 1_000_000) return { error: "Enter a fee above zero for each service you offer." };
      const { error } = await supabase.from("provider_services").upsert({ provider_id: user.id, service_id: id, fee_minor: Math.round(fee * 100) });
      if (error) return { error: "Not saved." };
    } else {
      await supabase.from("provider_services").delete().eq("provider_id", user.id).eq("service_id", id);
    }
  }
  revalidatePath("/portal/care/profile");
  return { ok: "Services and fees saved." };
}

export async function saveHours(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/portal/care/availability", ROLES);
  const rows: { provider_id: string; weekday: number; start_time: string; end_time: string }[] = [];
  for (let d = 0; d < 7; d++) {
    if (formData.get(`on:${d}`) !== "on") continue;
    const start = String(formData.get(`start:${d}`) ?? "");
    const end = String(formData.get(`end:${d}`) ?? "");
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) return { error: "Each working day needs a start time before its end time." };
    rows.push({ provider_id: user.id, weekday: d, start_time: start, end_time: end });
  }
  const supabase = await createClient();
  await supabase.from("provider_weekly_hours").delete().eq("provider_id", user.id);
  if (rows.length) {
    const { error } = await supabase.from("provider_weekly_hours").insert(rows);
    if (error) return { error: "Not saved." };
  }
  revalidatePath("/portal/care/availability");
  return { ok: "Working hours saved." };
}

export async function addTimeOff(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/portal/care/availability", ROLES);
  const p = z.object({ from: z.iso.date(), to: z.iso.date(), note: z.string().trim().max(200).optional() }).safeParse({ from: formData.get("from"), to: formData.get("to"), note: (formData.get("note") as string) || undefined });
  if (!p.success || p.data.from > p.data.to) return { error: "Choose a start date on or before the end date." };
  const supabase = await createClient();
  const from = new Date(`${p.data.from}T00:00:00+03:00`).toISOString();
  const to = new Date(new Date(`${p.data.to}T00:00:00+03:00`).getTime() + 864e5).toISOString();
  const { error } = await supabase.from("provider_time_off").insert({ provider_id: user.id, period: `[${from},${to})`, note: p.data.note ?? null });
  revalidatePath("/portal/care/availability");
  return error ? { error: "Not saved." } : { ok: "Time off added. You won't be offered visits then." };
}
