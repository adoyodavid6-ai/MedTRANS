export const CATEGORIES: Record<string, string> = {
  pharmacy_order: "A medicine order",
  prescription: "A prescription",
  doctorcare_booking: "A home visit",
  delivery: "A delivery",
  payment_refund: "A payment or refund",
  account: "My account",
  registration: "Registering as a pharmacy or professional",
  complaint: "A complaint",
  other: "Something else",
};

export const TICKET_STATUS: Record<string, { label: string; tone: "neutral" | "primary" | "warning" | "success" }> = {
  new: { label: "Received", tone: "warning" },
  open: { label: "Open", tone: "primary" },
  waiting_on_customer: { label: "Replied: waiting for you", tone: "primary" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};
