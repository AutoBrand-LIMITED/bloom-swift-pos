import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck } from "lucide-react";
import { SALES_STAFF } from "@/types/order";
import StepBadge from "@/components/pos/StepBadge";
import { useLanguage } from "@/contexts/LanguageContext";

interface SalesIdSectionProps {
  salesId: string;
  onSalesIdChange: (v: string) => void;
  isComplete?: boolean;
}

const SalesIdSection = ({ salesId, onSalesIdChange, isComplete }: SalesIdSectionProps) => {
  const { t } = useLanguage();
  return (
    <div className={`rounded-xl p-4 space-y-2 border transition-colors ${isComplete ? "bg-primary/[0.04] border-primary/20" : "bg-card border-border"}`}>
      <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/85 flex items-center gap-2">
        <StepBadge n={1} done={!!isComplete} />
        <UserCheck className="w-4 h-4" />
        {t("section_staff")}
      </h2>
      <div className="space-y-1">
        <Label className="text-xs">{t("label_responsible_staff")}</Label>
        <Select value={salesId} onValueChange={onSalesIdChange}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder={t("placeholder_select_staff")} />
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
