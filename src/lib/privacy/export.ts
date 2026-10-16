import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Builds a copy of one person's own data. Every query is filtered to records that person owns,
 * explicitly, as well as by RLS, so staff accounts never export other people's records they can see at work.
 * Prescription files are listed but not embedded; they can be opened from the account.
 */
export async function buildExport(db: SupabaseClient, uid: string) {
  const one = async (table: string, column: string, value: string | string[], select = "*") => {
    const q = db.from(table).select(select);
    const { data, error } = Array.isArray(value) ? await q.in(column, value.length ? value : ["00000000-0000-0000-0000-000000000000"]) : await q.eq(column, value);
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as unknown as Record<string, unknown>[];
  };
  const ids = (rows: Record<string, unknown>[]) => rows.map((r) => r.id as string);

  const [profile, roles, addresses, household, consents, orders, prescriptions, bookings, tickets, incidents, emergency, notifications, requests] = await Promise.all([
    one("profiles", "id", uid),
    one("user_roles", "user_id", uid, "role, granted_at, revoked_at"),
    one("addresses", "user_id", uid),
    one("household_members", "owner_id", uid),
    one("consent_records", "user_id", uid),
    one("orders", "patient_id", uid),
    one("prescriptions", "patient_id", uid),
    one("care_bookings", "patient_id", uid),
    one("support_tickets", "requester_id", uid),
    one("safety_incidents", "reporter_id", uid),
    one("emergency_requests", "user_id", uid),
    one("notifications", "user_id", uid),
    one("data_subject_requests", "user_id", uid),
  ]);
  const [orderItems, orderEvents, payments, rxItems, bookingEvents, visitRecords, messages] = await Promise.all([
    one("order_items", "order_id", ids(orders)),
    one("order_events", "order_id", ids(orders), "order_id, status, occurred_at, note"),
    one("payments", "order_id", ids(orders)),
    one("prescription_items", "prescription_id", ids(prescriptions)),
    one("booking_events", "booking_id", ids(bookings), "booking_id, status, occurred_at, note"),
    one("clinical_visit_records", "booking_id", ids(bookings)),
    db.from("support_messages").select("ticket_id, author_kind, body, created_at").in("ticket_id", ids(tickets).length ? ids(tickets) : ["00000000-0000-0000-0000-000000000000"]).eq("is_internal", false)
      .then(({ data, error }) => { if (error) throw new Error(`support_messages: ${error.message}`); return data ?? []; }),
  ]);

  return {
    generated_at: new Date().toISOString(),
    about: "A copy of the personal data MedTRANS holds about you, as at the time above. Prescription files are not included here; open them from your account.",
    profile: profile[0] ?? null,
    roles, addresses, household_members: household, consent_history: consents,
    pharmacy: { orders, order_items: orderItems, order_events: orderEvents, payments, prescriptions, prescription_items: rxItems },
    doctorcare: { bookings, booking_events: bookingEvents, visit_records: visitRecords },
    support: { tickets, messages },
    safety: { incidents, emergency_requests: emergency },
    notifications,
    data_requests: requests,
  };
}
