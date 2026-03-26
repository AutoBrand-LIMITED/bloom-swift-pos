import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck } from "lucide-react";
import { SALES_STAFF } from "@/types/order";

interface SalesIdSectionProps {
  salesId: string;
  onSalesIdChange: (v: string) => void;
}

const SalesIdSection = ({ salesId, onSalesIdChange }: SalesIdSectionProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
        <UserCheck className="w-4 h-4" />
        銷售員
      </h2>
      <div className="space-y-1">
        <Label className="text-xs">負責員工</Label>
        <Select value={salesId} onValueChange={onSalesIdChange}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="選擇員工" />
          </SelectTrigger>
          <SelectContent>
            {SALES_STAFF.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.id} — {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default SalesIdSection;
