import { useState } from "react";
import { BriefcaseBusiness, ChevronDown, ChevronUp } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BusinessDetailsSectionProps {
  customerGroup: string;
  senderDoNumber: string;
  recipientDoNumber: string;
  sourceReference: string;
  department: string;
  terms: string;
  onCustomerGroupChange: (value: string) => void;
  onSenderDoNumberChange: (value: string) => void;
  onRecipientDoNumberChange: (value: string) => void;
  onSourceReferenceChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onTermsChange: (value: string) => void;
}

const BusinessDetailsSection = ({
  customerGroup,
  senderDoNumber,
  recipientDoNumber,
  sourceReference,
  department,
  terms,
  onCustomerGroupChange,
  onSenderDoNumberChange,
  onRecipientDoNumberChange,
  onSourceReferenceChange,
  onDepartmentChange,
  onTermsChange,
}: BusinessDetailsSectionProps) => {
  const [expanded, setExpanded] = useState(false);
  const completedFieldCount = [
    customerGroup,
    senderDoNumber,
    recipientDoNumber,
    sourceReference,
    department,
    terms,
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
            以下欄位只記錄今張訂單，不會修改 Odoo CRM 分類或付款條款。
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
            <div className="space-y-1.5">
              <Label htmlFor="sender-do-number" className="text-xs">送花人 DO 編號</Label>
              <Input
                id="sender-do-number"
                value={senderDoNumber}
                onChange={(event) => onSenderDoNumberChange(event.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipient-do-number" className="text-xs">收花人 DO 編號</Label>
              <Input
                id="recipient-do-number"
                value={recipientDoNumber}
                onChange={(event) => onRecipientDoNumberChange(event.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="source-reference" className="text-xs">客戶參考／PO 編號</Label>
              <Input
                id="source-reference"
                value={sourceReference}
                onChange={(event) => onSourceReferenceChange(event.target.value)}
                placeholder="不會取代系統產生的 POS／發票編號"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="terms" className="text-xs">條款</Label>
              <Textarea
                id="terms"
                value={terms}
                onChange={(event) => onTermsChange(event.target.value)}
                placeholder="留空時會沿用付款狀態摘要"
                maxLength={1000}
                className="min-h-20"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessDetailsSection;
