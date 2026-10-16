import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { timeAgo } from "@/lib/pharmacy/status";
import { myPharmacyMemberships } from "@/lib/pharmacy/staff";
import { createClient } from "@/lib/supabase/server";
import { ListProductForm, StockRow } from "../forms";

export default async function Inventory() {
  await requireAccount("/portal/pharmacy/inventory", ["pharmacist", "pharmacy_admin"]);
  const ph = (await myPharmacyMemberships())[0]?.pharmacies;
  if (!ph) return <p>Not linked to a pharmacy.</p>;
  const supabase = await createClient();
  const [{ data: items }, { data: products }] = await Promise.all([
    supabase.from("inventory_items").select("id, price_minor, quantity_available, is_listed, stock_confirmed_at, product_id, medicine_products(name, strength, requires_prescription)").eq("pharmacy_id", ph.id),
    supabase.from("medicine_products").select("id, name, strength").eq("is_active", true).eq("is_controlled", false).order("name"),
  ]);
  const rows = (items ?? []) as unknown as { id: string; price_minor: number; quantity_available: number; is_listed: boolean; stock_confirmed_at: string; product_id: string; medicine_products: { name: string; strength: string; requires_prescription: boolean } }[];
  const listed = new Set(rows.map((r) => r.product_id));
  return (
    <>
      <Card className="space-y-4">
        <h2 className="text-xl font-semibold">Inventory</h2>
        <p className="text-sm text-muted">Patients see the time you last confirmed each price and stock level. Saving re-stamps it.</p>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 py-4">
              <p className="font-semibold text-navy">{r.medicine_products.name} {r.medicine_products.strength} <span className="text-sm font-normal text-muted">· confirmed {timeAgo(r.stock_confirmed_at)}</span></p>
              <StockRow id={r.id} name={r.medicine_products.name} price={r.price_minor} quantity={r.quantity_available} listed={r.is_listed} />
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-semibold">List another product</h2>
        <ListProductForm pharmacyId={ph.id} products={((products ?? []) as { id: string; name: string; strength: string }[]).filter((p) => !listed.has(p.id)).map((p) => ({ id: p.id, name: `${p.name} (${p.strength})` }))} />
      </Card>
    </>
  );
}
