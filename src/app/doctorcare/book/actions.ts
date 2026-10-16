"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type Slot = { slot_start: string; provider_count: number; min_fee_minor: number };
export type Candidate = { provider_id: string; display_name: string; profession: string; languages: string[]; years_experience: number | null; fee_minor: number; distance_m: number; language_match: boolean };

export async function getSlots(serviceId: string, addressId: string, day: string): Promise<Slot[]> {
  await requireAccount("/doctorcare/book");
  const p = z.object({ s: z.uuid(), a: z.uuid(), d: z.iso.date() }).safeParse({ s: serviceId, a: addressId, d: day });
  if (!p.success) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("available_slots", { p_service: p.data.s, p_address: p.data.a, p_day: p.data.d });
  return (data ?? []) as Slot[];
}

export async function getCandidates(serviceId: string, addressId: string, start: string, language: string | null): Promise<Candidate[]> {
  await requireAccount("/doctorcare/book");
  const p = z.object({ s: z.uuid(), a: z.uuid(), t: z.iso.datetime({ offset: true }) }).safeParse({ s: serviceId, a: addressId, t: start });
  if (!p.success) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("slot_providers", { p_service: p.data.s, p_address: p.data.a, p_start: p.data.t, p_language: language });
  return (data ?? []) as Candidate[];
}

const Screening = z.record(z.string(), z.boolean());

/** A red-flag answer: record it for safety review and send the person to emergency guidance. */
export async function escalate(serviceId: string, answers: Record<string, boolean>, idempotencyKey: string) {
  await requireAccount("/doctorcare/book");
  const p = z.object({ s: z.uuid(), k: z.uuid(), a: Screening }).safeParse({ s: serviceId, k: idempotencyKey, a: answers });
  if (p.success) {
    const supabase = await createClient();
    await supabase.rpc("create_booking", {
      p_idempotency_key: p.data.k, p_service: p.data.s, p_address: null, p_start: new Date().toISOString(),
      p_provider: null, p_screening: p.data.a,
    });
  }
  redirect("/emergency?from=doctorcare");
}

const Submit = z.object({
  idempotency_key: z.uuid(), service_id: z.uuid(), address_id: z.uuid(), start: z.iso.datetime({ offset: true }), provider_id: z.uuid(),
  screening: Screening, need_description: z.string().trim().max(1000).optional(), need_duration: z.enum(["today", "few_days", "week_plus", "ongoing"]).optional(),
  household_member_id: z.uuid().optional(), language: z.enum(["en", "sw", "so", "fr", "ar"]).optional(),
});

export async function submitBooking(input: unknown): Promise<{ error?: string }> {
  await requireAccount("/doctorcare/book");
  const p = Submit.safeParse(input);
  if (!p.success) return { error: "Some details are missing. Please check each step." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_idempotency_key: p.data.idempotency_key, p_service: p.data.service_id, p_address: p.data.address_id, p_start: p.data.start,
    p_provider: p.data.provider_id, p_screening: p.data.screening, p_need_description: p.data.need_description ?? null,
    p_need_duration: p.data.need_duration ?? null, p_household_member: p.data.household_member_id ?? null, p_language: p.data.language ?? null,
  });
  if (error) return { error: ["P0001", "22023"].includes(error.code ?? "") ? error.message : "We couldn't send your request. You have not been charged." };
  const row = (data as { booking_id: string; status: string }[])[0];
  if (row.status === "escalated") redirect("/emergency?from=doctorcare");
  redirect(`/bookings/${row.booking_id}`);
}
