import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck } from "lucide-react";
import { salesStaffDisplayName } from "@/hooks/use-odoo-employees";
import type { PosEmployeeIdentity } from "@/lib/pos-auth";
import type { OdooNamedReference, SalesStaff } from "@/types/order";

interface SalesIdSectionProps {
  salesId: string;
  salespersonEmployeeId?: number;
  salesTeamId?: number;
  department: string;
  staff: SalesStaff[];
  teams: OdooNamedReference[];
  staffLoading?: boolean;
  staffError?: string | null;
  teamsLoading?: boolean;
  teamsError?: string | null;
  locked?: boolean;
  onSalespersonChange: (label: string, employeeId: number) => void;
  onSalesTeamChange: (label: string, teamId?: number) => void;
  employee?: PosEmployeeIdentity | null;
}

const SalesIdSection = ({
  salesId,
  salespersonEmployeeId,
  salesTeamId,
  department,
  staff,
  teams,
  staffLoading = false,
  staffError,
  teamsLoading = false,
  teamsError,
  locked = false,
  onSalespersonChange,
  onSalesTeamChange,
  employee,
}: SalesIdSectionProps) => {
  const selectedStaff = staff.find((candidate) => candidate.odooEmployeeId === salespersonEmployeeId);
  const selectedTeam = teams.find((candidate) => candidate.id === salesTeamId);
  const salespersonIsLegacySnapshot = salespersonEmployeeId === undefined && Boolean(salesId.trim());
  const teamIsLegacySnapshot = salesTeamId === undefined && Boolean(department.trim());
  const salespersonDisabled = locked || staffLoading || Boolean(staffError) || staff.length === 0;
  const teamDisabled = locked || teamsLoading || Boolean(teamsError) || teams.length === 0;

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
            <Select
              value={salespersonEmployeeId ? String(salespersonEmployeeId) : undefined}
              disabled={salespersonDisabled}
              onValueChange={(value) => {
                const selected = staff.find((candidate) => candidate.odooEmployeeId === Number(value));
                if (selected?.odooEmployeeId) {
                  onSalespersonChange(salesStaffDisplayName(selected), selected.odooEmployeeId);
                }
              }}
            >
              <SelectTrigger className="min-h-11 touch-manipulation text-sm" aria-label="負責銷售員" aria-required="true">
                <SelectValue placeholder={staffLoading ? "正在載入 Odoo 員工..." : "選擇員工"} />
              </SelectTrigger>
              <SelectContent>
                {salespersonEmployeeId && !selectedStaff && (
                  <SelectItem value={String(salespersonEmployeeId)} disabled>
                    {salesId || `員工 #${salespersonEmployeeId}`}
                  </SelectItem>
                )}
                {staff.map((candidate) => candidate.odooEmployeeId ? (
                  <SelectItem key={candidate.odooEmployeeId} value={String(candidate.odooEmployeeId)}>
                    {salesStaffDisplayName(candidate)}
                  </SelectItem>
                ) : null)}
              </SelectContent>
            </Select>
          )}
          {salespersonIsLegacySnapshot && <p className="text-[10px] text-muted-foreground">舊訂單快照；重試時會原樣保留。</p>}
          {staffError && <p role="status" className="text-[10px] text-destructive">未能同步 Odoo 員工；不會提供未驗證選項。</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Sales Team（選填）</Label>
          {teamIsLegacySnapshot ? (
            <div
              className="flex min-h-11 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium"
              aria-label="Sales Team（選填）"
            >
              {department}
            </div>
          ) : (
            <Select
              value={salesTeamId ? String(salesTeamId) : "none"}
              disabled={teamDisabled}
              onValueChange={(value) => {
                if (value === "none") {
                  onSalesTeamChange("");
                  return;
                }
                const selected = teams.find((candidate) => candidate.id === Number(value));
                if (selected) onSalesTeamChange(selected.name, selected.id);
              }}
            >
              <SelectTrigger className="min-h-11 touch-manipulation text-sm" aria-label="Sales Team（選填）">
                <SelectValue placeholder={teamsLoading ? "正在載入 Sales Team..." : "選擇 Sales Team"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不指定</SelectItem>
                {salesTeamId && !selectedTeam && (
                  <SelectItem value={String(salesTeamId)} disabled>
                    {department || `Sales Team #${salesTeamId}`}
                  </SelectItem>
                )}
                {teams.map((team) => (
                  <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {teamIsLegacySnapshot && <p className="text-[10px] text-muted-foreground">舊部門快照；不會當成新 Sales Team 選項。</p>}
          {teamsError && <p role="status" className="text-[10px] text-destructive">未能同步 Sales Team；不會提供未驗證選項。</p>}
        </div>
      </div>
    </div>
  );
};

export default SalesIdSection;
