import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck } from "lucide-react";
import { salesStaffDisplayName, useOdooEmployees } from "@/hooks/use-odoo-employees";

interface SalesIdSectionProps {
  salesId: string;
  onSalespersonChange: (label: string, employeeId?: number) => void;
}

const SalesIdSection = ({ salesId, onSalespersonChange }: SalesIdSectionProps) => {
  const { staff, loading, error, usingOdoo } = useOdooEmployees();

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
        <UserCheck className="w-4 h-4" />
        銷售員
      </h2>
      <div className="space-y-1">
        <Label className="text-xs">
          負責員工 <span className="text-destructive" aria-hidden="true">*</span>
        </Label>
        <Select
          value={salesId}
          onValueChange={(value) => {
            const employee = staff.find((candidate) => salesStaffDisplayName(candidate) === value);
            onSalespersonChange(value, employee?.odooEmployeeId);
          }}
        >
          <SelectTrigger className="text-sm" aria-label="負責員工" aria-required="true">
            <SelectValue placeholder={loading ? "正在載入 Odoo 員工..." : "選擇員工"} />
          </SelectTrigger>
          <SelectContent>
            {staff.map((s) => {
              const displayName = salesStaffDisplayName(s);
              return (
                <SelectItem key={s.id} value={displayName}>
                  {displayName}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {error && (
          <p className="text-[10px] text-destructive">未能同步 Odoo 員工，暫時使用本機清單</p>
        )}
        {usingOdoo && <p className="text-[10px] text-muted-foreground">已同步 Odoo 員工清單</p>}
      </div>
    </div>
  );
};

export default SalesIdSection;
