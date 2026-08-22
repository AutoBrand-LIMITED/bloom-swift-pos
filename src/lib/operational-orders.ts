import type { Order } from "@/types/order";

export const OPERATIONAL_ORDERS_KEY = "florist-pos-operational-orders-v1";
// Browser storage is only a short-lived display cache. Supabase is the source of truth.
export const OPERATIONAL_ORDER_MAX_AGE_MS = 72 * 60 * 60 * 1000;

export type OperationalOrderTrackingState =
  | "pending_odoo"
  | "syncing"
  | "synced"
  | "needs_review";

export interface OperationalOrderRecord {
  operationalOrderId: string;
  operatorEmployeeId: number;
  order: Order;
  syncState: OperationalOrderTrackingState;
  reviewError: string | null;
  lastError: string | null;
  attemptCount: number;
  updatedAt: string;
}

const isOperationalOrderRecord = (value: unknown): value is OperationalOrderRecord => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OperationalOrderRecord>;
  return typeof candidate.operationalOrderId === "string"
    && typeof candidate.operatorEmployeeId === "number"
    && typeof candidate.updatedAt === "string"
    && Boolean(candidate.order)
    && typeof candidate.order?.id === "string"
    && ["pending_odoo", "syncing", "synced", "needs_review"].includes(
      candidate.syncState || "",
    );
};

const isCurrent = (record: OperationalOrderRecord, now = Date.now()) => {
  const updatedAt = Date.parse(record.updatedAt);
  return Number.isFinite(updatedAt)
    && updatedAt <= now
    && now - updatedAt <= OPERATIONAL_ORDER_MAX_AGE_MS;
};

const readAll = (): OperationalOrderRecord[] => {
  try {
    const value = JSON.parse(localStorage.getItem(OPERATIONAL_ORDERS_KEY) || "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(isOperationalOrderRecord).filter((record) => isCurrent(record));
  } catch {
    return [];
  }
};

const writeAll = (records: OperationalOrderRecord[]): void => {
  localStorage.setItem(OPERATIONAL_ORDERS_KEY, JSON.stringify(records));
};

export const loadOperationalOrders = (employeeId?: number): OperationalOrderRecord[] => {
  const all = readAll();
  writeAll(all);
  return employeeId === undefined
    ? all
    : all.filter((record) => record.operatorEmployeeId === employeeId);
};

export const saveOperationalOrdersForEmployee = (
  employeeId: number,
  records: OperationalOrderRecord[],
): void => {
  const otherEmployees = readAll().filter(
    (record) => record.operatorEmployeeId !== employeeId,
  );
  writeAll([...otherEmployees, ...records]);
};
