"use server";

import { z } from "zod";
import { createAnonClient } from "@/lib/supabase/server";

const Point = z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) });

export type NearResult = { ok: true; providers: { provider_id: string; display_name: string; profession: string; languages: string[]; distance_km: number; services: { slug: string; name: string; fee_minor: number }[] }[] } | { ok: false; message: string };

export async function findNear(input: unknown): Promise<NearResult> {
  const p = Point.safeParse(input);
  if (!p.success) return { ok: false, message: "That location doesn't look valid." };
  const { data, error } = await createAnonClient().rpc("providers_near", p.data);
  if (error) return { ok: false, message: "We couldn't search just now. Please try again." };
  return { ok: true, providers: (data ?? []) as Extract<NearResult, { ok: true }>["providers"] };
}
