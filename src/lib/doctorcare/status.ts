// Plain-language booking states (§8F). Each says what is actually happening.
export const BOOKING_STATUS: Record<string, { label: string; explanation: string; tone: "neutral" | "primary" | "warning" | "urgent" | "success" }> = {
  awaiting_acceptance: { label: "Waiting for the professional to accept", explanation: "We've asked a suitable, available professional. If they can't take it, we'll ask the next suitable one.", tone: "warning" },
  awaiting_payment: { label: "Accepted: pay to confirm", explanation: "The professional has accepted. Your visit is confirmed once payment is confirmed.", tone: "warning" },
  confirmed: { label: "Confirmed", explanation: "Your visit is booked and paid.", tone: "primary" },
  en_route: { label: "On the way", explanation: "The professional has set off to you.", tone: "primary" },
  arrived: { label: "Arrived", explanation: "The professional has arrived.", tone: "primary" },
  in_progress: { label: "Visit in progress", explanation: "Your visit is under way.", tone: "primary" },
  completed: { label: "Completed", explanation: "The visit is complete. Your visit summary is below.", tone: "success" },
  cancelled: { label: "Cancelled", explanation: "This booking was cancelled. You have not been charged.", tone: "neutral" },
  no_provider_available: { label: "No professional available", explanation: "No suitable professional could take this visit. You have not been charged.", tone: "urgent" },
  escalated: { label: "Directed to emergency help", explanation: "Your answers suggested this may be an emergency, so we stopped the routine booking.", tone: "urgent" },
  no_show: { label: "Visit didn't take place", explanation: "The professional couldn't reach you. Contact support about next steps.", tone: "urgent" },
  failed: { label: "Visit couldn't be completed", explanation: "Something prevented the visit. Our team will contact you.", tone: "urgent" },
  refund_processing: { label: "Refund in progress", explanation: "Your payment is being returned.", tone: "warning" },
  refunded: { label: "Refunded", explanation: "Your payment has been returned.", tone: "neutral" },
};

export const BOOKING_FLOW = ["awaiting_acceptance", "awaiting_payment", "confirmed", "en_route", "arrived", "in_progress", "completed"] as const;

export const NEED_DURATION: Record<string, string> = {
  today: "Started today",
  few_days: "A few days",
  week_plus: "A week or more",
  ongoing: "Ongoing / long-term",
};

export const LANGUAGES: Record<string, string> = { en: "English", sw: "Kiswahili", so: "Somali", fr: "French", ar: "Arabic" };

export function formatDistance(m: number | null | undefined) {
  if (m === null || m === undefined) return "";
  return m < 1000 ? `about ${m} m` : `about ${(m / 1000).toFixed(1)} km`;
}

export const fmtSlot = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }).format(new Date(iso));
