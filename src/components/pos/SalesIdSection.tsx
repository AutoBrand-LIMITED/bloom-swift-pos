import { useState } from "react";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ChevronsUpDown, UserCheck } from "lucide-react";
import { salesStaffDisplayName } from "@/hooks/use-odoo-employees";
import { cn } from "@/lib/utils";
import type { PosEmployeeIdentity } from "@/lib/pos-auth";
import type { OdooNamedReference, SalesStaff } from "@/types/order";

interface SalesIdSectionProps {
  salesId: string;
  salespersonEmployeeId?: number;
  department: string;
  salesTeamId?: number;
  salesTeams?: OdooNamedReference[];
  salesTeamsLoading?: boolean;
  salesTeamsError?: string | null;
  staff: SalesStaff[];
  staffLoading?: boolean;
  staffError?: string | null;
  locked?: boolean;
  onSalespersonChange: (
    label: string,
    employeeId: number,
    salesTeamId?: number,
    salesTeamName?: string,
  ) => void;
  onSalesTeamChange: (salesTeamId: number | undefined, salesTeamName: string) => void;
  employee?: PosEmployeeIdentity | null;
}

const SalesIdSection = ({
  salesId,
  salespersonEmployeeId,
  department,
  salesTeamId,
  salesTeams = [],
  salesTeamsLoading = false,
  salesTeamsError,
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
  const selectedTeam = salesTeams.find((team) => team.id === salesTeamId);
  const salesTeamName = selectedTeam?.name
    || (selectedStaff && selectedStaff.salesTeamId === salesTeamId
      ? selectedStaff.salesTeamName
      : undefined)
    || department.trim();
  const hasLinkedSalesTeam = Boolean(selectedStaff?.salesTeamId && selectedStaff.salesTeamName);
  const managerCanOverride = employee?.role === "manager";
  const salesTeamIsOverridden = Boolean(
    managerCanOverride
    && salesTeamId
    && salesTeamId !== selectedStaff?.salesTeamId,
  );

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
                              candidate.salesTeamId,
                              candidate.salesTeamName,
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
          <Label className="text-xs">Sales Team</Label>
          {managerCanOverride ? (
            <Select
              value={salesTeamId ? String(salesTeamId) : "unassigned"}
              disabled={
                locked
                || !selectedStaff
                || salesTeamsLoading
                || Boolean(salesTeamsError)
              }
              onValueChange={(value) => {
                if (value === "unassigned") {
                  onSalesTeamChange(undefined, "");
                  return;
                }
                const team = salesTeams.find((candidate) => candidate.id === Number(value));
                if (team) onSalesTeamChange(team.id, team.name);
              }}
            >
              <SelectTrigger aria-label="Sales Team" className="min-h-11 touch-manipulation text-sm">
                <SelectValue placeholder={salesTeamsLoading ? "正在載入 Odoo Sales Team..." : "選擇 Sales Team"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned" disabled={hasLinkedSalesTeam}>
                  {hasLinkedSalesTeam ? "請跟隨 Employee 預設" : "未指定"}
                </SelectItem>
                {salesTeamId && !salesTeams.some((team) => team.id === salesTeamId) && (
                  <SelectItem value={String(salesTeamId)} disabled>
                    {salesTeamName || `Sales Team #${salesTeamId}`}
                  </SelectItem>
                )}
                {salesTeams.map((team) => (
                  <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div
              className={cn(
                "flex min-h-11 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium",
                !salesTeamName && "text-amber-700",
              )}
              aria-label="Sales Team"
              data-sales-team-id={salesTeamId || undefined}
            >
              {salesTeamName || "未連結 Sales Team"}
            </div>
          )}
          <p className={cn(
            "text-[10px] text-muted-foreground",
            (selectedStaff && !hasLinkedSalesTeam) || salesTeamsError ? "text-amber-700" : undefined,
          )}>
            {salesTeamsError
              ? "未能同步 Odoo Sales Team；暫時唔可以主管覆寫。"
              : salesTeamIsOverridden
                ? `今張訂單由主管覆寫；Employee 預設仍為 ${selectedStaff?.salesTeamName || "未指定"}。`
                : selectedStaff && !hasLinkedSalesTeam
                  ? "請先於 Odoo Employees 連結 Sales Team；未連結訂單不會計入 Team 統計。"
                  : managerCanOverride
                    ? "預設跟隨 Odoo Employee；主管只會覆寫今張訂單。"
                    : "由 Odoo Employees 連結；選擇負責銷售員後會自動帶入。"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SalesIdSection;
