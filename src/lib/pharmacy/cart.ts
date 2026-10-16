import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Quote = {
  empty: boolean;
  pharmacy?: { id: string; name: string; slug: string };
  currency?: string;
  lines?: { inventory_id: string; product_id: string; slug: string; name: string; strength: string; pack_size: string; requires_prescription: boolean; quantity: number; unit_price_minor: number; line_total_minor: number; quantity_available: number }[];
  needs_prescription?: boolean;
  subtotal_minor?: number;
  delivery_fee_minor?: number | null;
  service_fee_minor?: number | null;
  tax_minor?: number;
  total_minor?: number | null;
  issues?: string[];
};

type Rx = { id: string; status: string; valid_until: string | null; created_at: string; prescription_items: { product_id: string; quantity_requested: number; quantity_approved: number | null }[]; prescription_reviews: { note_to_patient: string | null; created_at: string }[] };

/** Approved, unexpired, unused prescription at this pharmacy covering every Rx line in the cart. */
export function coveringPrescription(quote: Quote, rxs: Rx[], usedIds: Set<string>) {
  const rxLines = (quote.lines ?? []).filter((l) => l.requires_prescription);
  const today = new Date().toISOString().slice(0, 10);
  return rxs.find((r) =>
    r.status === "approved" && r.valid_until !== null && r.valid_until >= today && !usedIds.has(r.id) &&
    rxLines.every((l) => (r.prescription_items.find((i) => i.product_id === l.product_id)?.quantity_approved ?? 0) >= l.quantity),
  );
}

export async function loadCartContext() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("quote_cart", { p_address: null });
  const quote = (data ?? { empty: true }) as Quote;
  let rxs: Rx[] = [];
  let used = new Set<string>();
  if (!quote.empty && quote.needs_prescription && quote.pharmacy) {
    const { data: r } = await supabase
      .from("prescriptions")
      .select("id, status, valid_until, created_at, prescription_items(product_id, quantity_requested, quantity_approved), prescription_reviews(note_to_patient, created_at)")
      .eq("pharmacy_id", quote.pharmacy.id)
      .order("created_at", { ascending: false });
    rxs = (r ?? []) as Rx[];
    const { data: o } = await supabase.from("orders").select("prescription_id").not("prescription_id", "is", null).not("status", "in", "(cancelled,refund_processing,refunded)");
    used = new Set((o ?? []).map((x) => x.prescription_id as string));
  }
  return { quote, rxs, covering: coveringPrescription(quote, rxs, used) };
}

