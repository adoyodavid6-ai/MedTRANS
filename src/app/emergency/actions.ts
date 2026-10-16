"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { normalisePhone } from "@/lib/auth/identifier";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const Req = z.object({
  phone: z.string(),
  name: z.string().trim().max(120).optional(),
  nature: z.string().trim().max(500).optional(),
  conscious: z.enum(["yes", "no", "unknown"]).default("unknown"),
  breathing: z.enum(["yes", "no", "unknown"]).default("unknown"),
  share: z.enum(["on"]).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  location_text: z.string().trim().max(300).optional(),
});

export async function requestCallback(_prev: FormState, formData: FormData): Promise<FormState> {
  const get = (k: string) => (formData.get(k) as string) || undefined;
  const p = Req.safeParse({ phone: get("phone") ?? "", name: get("name"), nature: get("nature"), conscious: get("conscious"), breathing: get("breathing"), share: get("share"), lat: get("lat"), lng: get("lng"), location_text: get("location_text") });
  const phone = p.success ? normalisePhone(p.data.phone) : null;
  if (!p.success || !phone) return { fieldErrors: { phone: "Enter the number we should call, e.g. 0712 345 678." }, values: { phone: get("phone") ?? "" } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_emergency_request", {
    p_callback_phone: phone, p_caller_name: p.data.name ?? null, p_nature: p.data.nature ?? null, p_conscious: p.data.conscious, p_breathing: p.data.breathing,
    p_share_location: Boolean(p.data.share), p_lat: p.data.share ? p.data.lat ?? null : null, p_lng: p.data.share ? p.data.lng ?? null : null,
    p_location_text: p.data.location_text ?? null,
  });
  if (error) return { error: "We couldn't send your request. Call local emergency services now." };
  const row = (data as { public_token: string }[])[0];
  redirect(`/emergency/requests/${row.public_token}`);
}
