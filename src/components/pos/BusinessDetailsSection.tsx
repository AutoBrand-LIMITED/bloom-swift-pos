import { useState } from "react";
import { BriefcaseBusiness, ChevronDown, ChevronUp } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BusinessDetailsSectionProps {
  customerGroup: string;
  department: string;
  onCustomerGroupChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
}

const BusinessDetailsSection = ({
  customerGroup,
  department,
  onCustomerGroupChange,
  onDepartmentChange,
}: BusinessDetailsSectionProps) => {
  const [expanded, setExpanded] = useState(false);
  const completedFieldCount = [
    customerGroup,
    department,
  ].filter((value) => value.trim()).length;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={expanded}
        aria-controls="business-details-content"
        onClick={() => setExpanded((current) => !current)}
      >
        <BriefcaseBusiness className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          業務資料
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {completedFieldCount > 0 ? `${completedFieldCount} 項已填` : "選填"}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div id="business-details-content" className="space-y-3 border-t border-border px-4 py-4">
          <p className="text-xs text-muted-foreground">
            以下欄位只記錄今張訂單，不會修改 Odoo CRM 分類。
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="customer-group" className="text-xs">客戶群組</Label>
              <Input
                id="customer-group"
                value={customerGroup}
                onChange={(event) => onCustomerGroupChange(event.target.value)}
                placeholder="例如：Corporate、VIP"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department" className="text-xs">部門</Label>
              <Input
                id="department"
                value={department}
                onChange={(event) => onDepartmentChange(event.target.value)}
                placeholder="例如：Marketing"
                maxLength={200}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessDetailsSection;
