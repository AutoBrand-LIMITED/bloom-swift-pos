import { Badge } from "@/components/ui/badge";
import type { CustomerTag } from "@/data/demo-customers";
import { getManagedCustomerFlags } from "@/lib/customer-notes";
import { cn } from "@/lib/utils";

interface CustomerFlagsProps {
  tags?: CustomerTag[];
  className?: string;
}

const flagClassName: Record<string, string> = {
  VIP: "border-emerald-600/30 bg-emerald-50 text-emerald-800",
  "Late Payer": "border-destructive/30 bg-destructive/10 text-destructive",
  "Difficult Customer": "border-amber-500/40 bg-amber-50 text-amber-800",
  "Special Handling": "border-sky-500/40 bg-sky-50 text-sky-800",
};

const flagLabel: Record<string, string> = {
  VIP: "VIP",
  "Late Payer": "遲付款",
  "Difficult Customer": "需特別溝通",
  "Special Handling": "特別處理",
};

const CustomerFlags = ({ tags, className }: CustomerFlagsProps) => {
  const flags = getManagedCustomerFlags(tags);
  if (flags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} aria-label="客戶標記">
      {flags.map((flag) => (
        <Badge
          key={flag.id}
          variant="outline"
          className={cn("px-2 py-0.5 text-[10px]", flagClassName[flag.name])}
        >
          {flagLabel[flag.name] ?? flag.name}
        </Badge>
      ))}
    </div>
  );
};

export default CustomerFlags;
