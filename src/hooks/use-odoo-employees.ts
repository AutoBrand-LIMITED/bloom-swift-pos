import { useEffect, useMemo, useState } from "react";
import { getOdooEmployees, hasOdooBackend } from "@/lib/odoo-api";
import { SALES_STAFF, type SalesStaff } from "@/types/order";

export function useOdooEmployees() {
  const [odooStaff, setOdooStaff] = useState<SalesStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasOdooBackend) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getOdooEmployees(controller.signal)
      .then(setOdooStaff)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setOdooStaff([]);
        setError(err instanceof Error ? err.message : "未能同步 Odoo 員工");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const staff = odooStaff.length > 0 ? odooStaff : SALES_STAFF;
  const staffById = useMemo(() => new Map(staff.map((employee) => [employee.id, employee])), [staff]);

  return {
    staff,
    staffById,
    loading,
    error,
    usingOdoo: odooStaff.length > 0,
  };
}

export function salesStaffDisplayName(employee: SalesStaff) {
  const prefix = employee.code || employee.id;
  return prefix ? `${prefix} — ${employee.name}` : employee.name;
}

export function salesStaffLabel(staffById: Map<string, SalesStaff>, salesId: string) {
  if (!salesId) return "未指定";

  const employee = staffById.get(salesId);
  if (employee) return salesStaffDisplayName(employee);

  return salesId;
}
