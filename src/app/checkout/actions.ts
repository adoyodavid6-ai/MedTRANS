"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const Input = z.object({
  idempotency_key: z.uuid(),
  address_id: z.uuid({ error: "Choose a delivery address." }),
  prescription_id: z.uuid().optional(),
  household_member_id: z.uuid().optional(),
});

export async function placeOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/checkout");
  const p = Input.safeParse({
    idempotency_key: formData.get("idempotency_key"),
    address_id: formData.get("address_id") || undefined,
    prescription_id: (formData.get("prescription_id") as string) || undefined,
    household_member_id: (formData.get("household_member_id") as string) || undefined,
  });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Please check your choices." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_idempotency_key: p.data.idempotency_key,
    p_address: p.data.address_id,
    p_prescription: p.data.prescription_id ?? null,
    p_household_member: p.data.household_member_id ?? null,
  });
  if (error) return { error: error.code === "P0001" ? error.message : "We couldn't place your order. Nothing has been charged. Please try again." };
  redirect(`/orders/${data as string}`);
}
