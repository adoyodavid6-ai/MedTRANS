"use server";

import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createAnonClient } from "@/lib/supabase/server";

const Point = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export type CoverageResult =
  | { state: "covered"; areas: { name: string; modules: string[] }[] }
  | { state: "not_covered" }
  | { state: "error"; message: string };

export async function checkCoverage(input: unknown): Promise<CoverageResult> {
  const parsed = Point.safeParse(input);
  if (!parsed.success) return { state: "error", message: "That location doesn't look valid. Please try again." };
  if (!isSupabaseConfigured()) return { state: "error", message: "Coverage checking is not available right now." };

  const { data, error } = await createAnonClient().rpc("check_coverage", parsed.data);
  if (error) return { state: "error", message: "We couldn't check coverage just now. Please try again shortly." };

  const rows = (data ?? []) as { area_name: string; active_modules: string[] }[];
  if (rows.length === 0) return { state: "not_covered" };
  return { state: "covered", areas: rows.map((r) => ({ name: r.area_name, modules: r.active_modules })) };
}
