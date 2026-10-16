"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const Inquiry = z.object({
  category: z.enum(["pharmacy_order", "prescription", "doctorcare_booking", "delivery", "payment_refund", "account", "registration", "complaint", "other"], { error: "Choose what this is about." }),
  subject: z.string({ error: "Give your message a short subject." }).trim().min(3).max(160),
  body: z.string({ error: "Tell us how we can help." }).trim().min(5).max(4000),
  guest_name: z.string().trim().max(120).optional(),
  guest_contact: z.string().trim().max(254).optional(),
  preferred_contact: z.enum(["in_app", "email", "phone"]).optional(),
  consent: z.literal("on", { error: "We need your agreement to store and reply to your message." }),
});

export async function sendInquiry(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  const names = ["category", "subject", "body", "guest_name", "guest_contact", "preferred_contact", "consent"];
  const p = Inquiry.safeParse(formFields(formData, names));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values: submittedValues(formData, names) };
  if (!user && !p.data.guest_contact) return { fieldErrors: { guest_contact: "Give us an email address or phone number so we can reply." }, values: submittedValues(formData, names) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_ticket", {
    p_category: p.data.category, p_subject: p.data.subject, p_body: p.data.body,
    p_guest_name: p.data.guest_name ?? null, p_guest_contact: p.data.guest_contact ?? null,
    p_preferred_contact: p.data.preferred_contact ?? (user ? "in_app" : "email"),
  });
  if (error) return { error: error.code === "P0001" ? error.message : "We couldn't send your message. Please try again.", values: submittedValues(formData, names) };
  const row = (data as { ticket_id: string; ticket_number: string; access_token: string }[])[0];
  redirect(user ? `/account/support/${row.ticket_id}?new=1` : `/support/${row.access_token}?new=1`);
}

export async function replyAsCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const ticket = z.uuid().safeParse(formData.get("ticket_id"));
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const token = (formData.get("token") as string) || null;
  if (!ticket.success) return { error: "Unknown ticket." };
  if (!body) return { fieldErrors: { body: "Write your reply." } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("customer_reply", { p_ticket: ticket.data, p_body: body, p_token: token });
  if (error) return { error: error.code === "P0001" ? error.message : "Your reply wasn't sent." };
  const { revalidatePath } = await import("next/cache");
  revalidatePath(token ? `/support/${token}` : `/account/support/${ticket.data}`);
  return { ok: "Reply sent." };
}

export async function rateTicket(_prev: FormState, formData: FormData): Promise<FormState> {
  const ticket = z.uuid().safeParse(formData.get("ticket_id"));
  const rating = Number(formData.get("rating"));
  const token = (formData.get("token") as string) || null;
  if (!ticket.success || !(rating >= 1 && rating <= 5)) return { error: "Choose a rating from 1 to 5." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("rate_ticket", { p_ticket: ticket.data, p_rating: rating, p_comment: (formData.get("comment") as string) || null, p_token: token });
  return error ? { error: "We couldn't save your rating." } : { ok: "Thank you for your feedback." };
}
