import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, UserCheck } from "lucide-react";
import { salesStaffDisplayName } from "@/hooks/use-odoo-employees";
import { cn } from "@/lib/utils";
import type { PosEmployeeIdentity } from "@/lib/pos-auth";
import type { SalesStaff } from "@/types/order";

interface SalesIdSectionProps {
  salesId: string;
  salespersonEmployeeId?: number;
  department: string;
  staff: SalesStaff[];
  staffLoading?: boolean;
  staffError?: string | null;
  locked?: boolean;
  onSalespersonChange: (label: string, employeeId: number) => void;
  onSalesTeamChange: (label: string) => void;
  employee?: PosEmployeeIdentity | null;
}

const SalesIdSection = ({
  salesId,
  salespersonEmployeeId,
  department,
  staff,
  staffLoading = false,
  staffError,
  locked = false,
  onSalespersonChange,
  onSalesTeamChange,
  employee,
}: SalesIdSectionProps) => {
  const [salespersonOpen, setSalespersonOpen] = useState(false);
  const selectedStaff = staff.find((candidate) => candidate.odooEmployeeId === salespersonEmployeeId);
  const salespersonIsLegacySnapshot = salespersonEmployeeId === undefined && Boolean(salesId.trim());
  const salespersonDisabled = locked || staffLoading || Boolean(staffError) || staff.length === 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
        <UserCheck className="w-4 h-4" />
        銷售員
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">登入操作員</Label>
          <div
            className="flex min-h-11 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium"
            aria-label="登入操作員"
          >
            {employee?.salesLabel || "未登入"}
          </div>
          <p className="text-[10px] text-muted-foreground">唯讀審計身份；更改負責銷售員不會改變登入權限。</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            負責銷售員 <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          {salespersonIsLegacySnapshot ? (
            <div
              className="flex min-h-11 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium"
              aria-label="負責銷售員"
            >
              {salesId}
            </div>
          ) : (
            <Popover open={salespersonOpen} onOpenChange={setSalespersonOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-label="負責銷售員"
                  aria-required="true"
                  aria-expanded={salespersonOpen}
                  disabled={salespersonDisabled}
                  className="min-h-11 w-full justify-between touch-manipulation px-3 text-sm font-normal"
                >
                  <span className="truncate text-left">
                    {selectedStaff
                      ? salesStaffDisplayName(selectedStaff)
                      : salesId || (staffLoading ? "正在載入 Odoo 員工..." : "選擇員工")}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput aria-label="搜尋負責銷售員" placeholder="搜尋員工編號或姓名..." />
                  <CommandList>
                    <CommandEmpty>找不到符合嘅銷售員</CommandEmpty>
                    <CommandGroup>
                      {salespersonEmployeeId && !selectedStaff && (
                        <CommandItem disabled value={salesId || `員工 ${salespersonEmployeeId}`}>
                          {salesId || `員工 #${salespersonEmployeeId}`}
                        </CommandItem>
                      )}
                      {staff.map((candidate) => candidate.odooEmployeeId ? (
                        <CommandItem
                          key={candidate.odooEmployeeId}
                          value={`${candidate.code || candidate.id} ${candidate.name}`}
                          onSelect={() => {
                            onSalespersonChange(
                              salesStaffDisplayName(candidate),
                              candidate.odooEmployeeId!,
                            );
                            setSalespersonOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              candidate.odooEmployeeId === salespersonEmployeeId
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                            aria-hidden="true"
                          />
                          {salesStaffDisplayName(candidate)}
                        </CommandItem>
                      ) : null)}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          {salespersonIsLegacySnapshot && <p className="text-[10px] text-muted-foreground">舊訂單快照；重試時會原樣保留。</p>}
          {staffError && <p role="status" className="text-[10px] text-destructive">未能同步 Odoo 員工；不會提供未驗證選項。</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Sales Team（選填）</Label>
          <Input
            aria-label="Sales Team（選填）"
            value={department}
            disabled={locked}
            maxLength={200}
            placeholder="輸入 Sales Team"
            className="min-h-11 touch-manipulation text-sm"
            onChange={(event) => onSalesTeamChange(event.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">自由輸入訂單快照；不會自動配對 Odoo Sales Team。</p>
        </div>
      </div>
    </div>
  );
};

export default SalesIdSection;
