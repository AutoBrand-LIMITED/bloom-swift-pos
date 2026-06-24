import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck } from "lucide-react";
import { SALES_STAFF } from "@/types/order";

interface SalesIdSectionProps {
  salesId: string;
  onSalesIdChange: (v: string) => void;
  isComplete?: boolean;
}

const SalesIdSection = ({ salesId, onSalesIdChange, isComplete }: SalesIdSectionProps) => {
  return (
    <div className={`rounded-xl bg-card p-4 space-y-2 transition-colors ${
      isComplete ? "border-t border-r border-b border-l-4 border-t-primary/30 border-r-primary/30 border-b-primary/30 border-l-primary" : "border border-border"
    }`}>
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
        <span className="text-primary font-bold text-base">①</span>
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
