"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor, isRole, safeNextPath } from "@/lib/auth/roles";
import { maskIdentifier, parseIdentifier } from "@/lib/auth/identifier";
import { createClient } from "@/lib/supabase/server";

export type SignInState =
  | { step: "identify"; error?: string; value?: string }
  | { step: "verify"; identifier: string; masked: string; error?: string; notice?: string };

const GENERIC_SEND_ERROR = "We couldn't send a code just now. Please wait a moment and try again.";

/** Single entry point for the sign-in form: request a code, then verify it. */
export async function signInStep(prev: SignInState, formData: FormData): Promise<SignInState> {
  return formData.get("intent") === "verify" ? verifyCode(prev, formData) : requestCode(prev, formData);
}

async function requestCode(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const raw = String(formData.get("identifier") ?? "");
  const id = parseIdentifier(raw);
  if (!id) {
    return {
      step: "identify",
      value: raw.slice(0, 100),
      error: "Enter a mobile number (for example 0712 345 678 or +254 712 345 678) or an email address.",
    };
  }

  const supabase = await createClient();
  const { error } =
    id.kind === "phone"
      ? await supabase.auth.signInWithOtp({ phone: id.e164 })
      : await supabase.auth.signInWithOtp({ email: id.email, options: { shouldCreateUser: true } });

  if (error) {
    const rateLimited = error.status === 429 || /rate|seconds/i.test(error.message);
    return {
      step: "identify",
      value: raw.slice(0, 100),
      error: rateLimited ? "Too many codes requested. Please wait a minute before trying again." : GENERIC_SEND_ERROR,
    };
  }

  return {
    step: "verify",
    identifier: id.kind === "phone" ? id.e164 : id.email,
    masked: maskIdentifier(id),
    notice: id.kind === "phone" ? "We sent a 6-digit code by SMS." : "We sent a 6-digit code to your email.",
  };
}

const Code = z.string().regex(/^\d{6}$/);

async function verifyCode(prev: SignInState, formData: FormData): Promise<SignInState> {
  const identifier = String(formData.get("identifier") ?? "");
  const id = parseIdentifier(identifier);
  if (!id) return { step: "identify", error: "Please start again." };

  const masked = maskIdentifier(id);
  const code = Code.safeParse(String(formData.get("code") ?? "").replace(/\s/g, ""));
  if (!code.success) return { step: "verify", identifier, masked, error: "Enter the 6-digit code." };

  const supabase = await createClient();
  const { data, error } =
    id.kind === "phone"
      ? await supabase.auth.verifyOtp({ phone: id.e164, token: code.data, type: "sms" })
      : await supabase.auth.verifyOtp({ email: id.email, token: code.data, type: "email" });

  if (error || !data.user) {
    return { step: "verify", identifier, masked, error: "That code is incorrect or has expired. Check it, or request a new one." };
  }

  const { data: roleRows } = await supabase.rpc("my_roles");
  const roles = ((roleRows as unknown[] | null) ?? []).filter(isRole);
  const next = safeNextPath(formData.get("next"));
  redirect(next ?? homeFor(roles));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
