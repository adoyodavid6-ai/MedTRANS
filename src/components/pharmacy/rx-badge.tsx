import { FileText, ShoppingBag, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function RxBadge({ rx, controlled = false }: { rx: boolean; controlled?: boolean }) {
  if (controlled) {
    return (
      <Badge tone="urgent">
        <ShieldOff aria-hidden className="size-3.5" />
        Not sold through MedTRANS
      </Badge>
    );
  }
  return rx ? (
    <Badge tone="warning">
      <FileText aria-hidden className="size-3.5" />
      Prescription only
    </Badge>
  ) : (
    <Badge tone="primary">
      <ShoppingBag aria-hidden className="size-3.5" />
      Over the counter
    </Badge>
  );
}
