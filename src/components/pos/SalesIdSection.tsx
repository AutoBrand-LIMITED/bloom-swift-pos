import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck } from "lucide-react";
import { salesStaffDisplayName, useOdooEmployees } from "@/hooks/use-odoo-employees";
import type { PosEmployeeIdentity } from "@/lib/pos-auth";

interface SalesIdSectionProps {
  salesId: string;
  onSalespersonChange: (label: string, employeeId?: number) => void;
  employee?: PosEmployeeIdentity | null;
}

const SalesIdSection = ({ salesId, onSalespersonChange, employee }: SalesIdSectionProps) => {
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
        {employee ? (
          <div
            className="flex min-h-12 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium"
            aria-label="負責員工"
          >
            {employee.salesLabel}
          </div>
        ) : <Select
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
        </Select>}
        {employee && (
          <p className="text-[10px] text-muted-foreground">由目前登入帳戶自動設定，不能切換其他員工。</p>
        )}
        {!employee && error && (
          <p className="text-[10px] text-destructive">未能同步 Odoo 員工，暫時使用本機清單</p>
        )}
        {!employee && usingOdoo && <p className="text-[10px] text-muted-foreground">已同步 Odoo 員工清單</p>}
      </div>
    </div>
  );
};

export default SalesIdSection;
