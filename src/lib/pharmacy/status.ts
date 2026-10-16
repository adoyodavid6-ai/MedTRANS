// Plain-language labels for order and prescription states (§7E). Each explains what is really happening.

export const ORDER_STATUS: Record<string, { label: string; explanation: string; tone: "neutral" | "primary" | "warning" | "urgent" | "success" }> = {
  pending_payment: { label: "Awaiting payment", explanation: "Your order is reserved. It will be cancelled if not paid within 30 minutes.", tone: "warning" },
  awaiting_pharmacy_acceptance: { label: "Awaiting pharmacy acceptance", explanation: "Payment confirmed. The pharmacy has not yet accepted the order.", tone: "primary" },
  confirmed: { label: "Confirmed", explanation: "The pharmacy has accepted your order.", tone: "primary" },
  preparing: { label: "Preparing", explanation: "The pharmacy is preparing your medicines.", tone: "primary" },
  ready_for_dispatch: { label: "Ready for dispatch", explanation: "Packed and waiting for a delivery partner.", tone: "primary" },
  assigned_to_courier: { label: "Assigned to a delivery partner", explanation: "A verified delivery partner will collect it from the pharmacy.", tone: "primary" },
  out_for_delivery: { label: "Out for delivery", explanation: "The delivery partner has collected your order. Give them your handover code when it arrives.", tone: "primary" },
  delivered: { label: "Delivered", explanation: "Handed over and confirmed with your code.", tone: "success" },
  cancelled: { label: "Cancelled", explanation: "This order was cancelled. You have not been charged.", tone: "neutral" },
  failed_delivery: { label: "Delivery not completed", explanation: "The delivery could not be completed. Our team will arrange next steps.", tone: "urgent" },
  refund_processing: { label: "Refund in progress", explanation: "Your payment is being returned.", tone: "warning" },
  refunded: { label: "Refunded", explanation: "Your payment has been returned.", tone: "neutral" },
};

export const ORDER_FLOW = [
  "pending_payment",
  "awaiting_pharmacy_acceptance",
  "confirmed",
  "preparing",
  "ready_for_dispatch",
  "assigned_to_courier",
  "out_for_delivery",
  "delivered",
] as const;

export const PRESCRIPTION_STATUS: Record<string, { label: string; tone: "neutral" | "primary" | "warning" | "urgent" | "success" }> = {
  submitted: { label: "Waiting for pharmacist review", tone: "warning" },
  approved: { label: "Approved by pharmacist", tone: "success" },
  clarification_needed: { label: "Pharmacist has a question", tone: "urgent" },
  rejected: { label: "Not approved", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

/** "In stock" unless few remain; never invents availability. */
export function stockLabel(qty: number) {
  if (qty <= 0) return "Out of stock";
  if (qty <= 5) return `Only ${qty} left`;
  return "In stock";
}

export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

/** Suggested approval validity (30 days from today) for the pharmacist's review form. The pharmacist decides. */
export function suggestedValidUntil(days = 30) {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}

/** ISO timestamp `days` ago, for "last N days" queries. */
export function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 864e5).toISOString();
}
