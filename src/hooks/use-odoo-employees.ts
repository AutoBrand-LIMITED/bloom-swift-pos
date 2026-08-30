import { useEffect, useMemo, useState } from "react";
import {
  getOdooCustomerGroups,
  getOdooEmployees,
  getOdooSalesTeams,
  hasOdooBackend,
} from "@/lib/odoo-api";
import type { OdooNamedReference, SalesStaff } from "@/types/order";

function useOdooReferenceList<T>(
  loader: (signal?: AbortSignal) => Promise<T[]>,
  fallbackError: string,
  enabled = true,
) {
  const [values, setValues] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !hasOdooBackend) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    loader(controller.signal)
      .then(setValues)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setValues([]);
        setError(err instanceof Error ? err.message : fallbackError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enabled, fallbackError, loader]);

  return { values, loading, error };
}

export function useOdooEmployees(enabled = true) {
  const { values: staff, loading, error } = useOdooReferenceList<SalesStaff>(
    getOdooEmployees,
    "未能同步 Odoo 員工",
    enabled,
  );
  const staffById = useMemo(() => new Map(staff.map((employee) => [employee.id, employee])), [staff]);

  return {
    staff,
    staffById,
    loading,
    error,
    usingOdoo: !error && staff.length > 0,
  };
}

export function useOdooSalesTeams(enabled = true) {
  const { values, ...status } = useOdooReferenceList<OdooNamedReference>(
    getOdooSalesTeams,
    "未能同步 Odoo Sales Team",
    enabled,
  );
  return { teams: values, ...status };
}

export function useOdooCustomerGroups(enabled = true) {
  const { values, ...status } = useOdooReferenceList<OdooNamedReference>(
    getOdooCustomerGroups,
    "未能同步 Odoo 客戶群組",
    enabled,
  );
  return { groups: values, ...status };
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
