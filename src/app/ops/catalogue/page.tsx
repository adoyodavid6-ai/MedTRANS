import { RxBadge } from "@/components/pharmacy/rx-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../pharmacy-forms";
import { RecallForm } from "../support-forms";

export default async function Catalogue() {
  await requireAccount("/ops/catalogue", ["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("medicine_products").select("id, name, strength, dosage_form, pack_size, requires_prescription, is_controlled, vat_rate_bps, approved_info, recalled_at, recall_note").order("name");
  return (
    <>
      <Card>
        <h2 className="text-xl font-semibold">Catalogue</h2>
        <ul className="mt-3 divide-y divide-line">
          {(data ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span>{m.name} · {m.strength} · {m.dosage_form} · {m.pack_size}</span>
              <span className="flex flex-wrap gap-1.5">
                <RxBadge rx={m.requires_prescription} controlled={m.is_controlled} />
                {m.vat_rate_bps === null ? <Badge tone="warning">VAT not set</Badge> : <Badge>VAT {m.vat_rate_bps / 100}%</Badge>}
                {m.approved_info ? <Badge tone="success">Approved info</Badge> : <Badge>No approved info</Badge>}
                {m.recalled_at ? <Badge tone="urgent">Recalled</Badge> : <RecallForm productId={m.id} />}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card><h2 className="mb-3 text-lg font-semibold">Add a product</h2><ProductForm /></Card>
    </>
  );
}
