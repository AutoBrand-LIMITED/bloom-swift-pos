import type { Order } from "@/types/order";
import type {
  OperationalOrderCollectionRow,
  OperationalOrderStatusResponse,
} from "@/lib/odoo-api";

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
  retryEligible: boolean;
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

export const clearOperationalOrders = (): void => {
  localStorage.removeItem(OPERATIONAL_ORDERS_KEY);
};

export const loadOperationalOrders = (employeeId?: number): OperationalOrderRecord[] => {
  const all = readAll().filter((record) => isCurrentBusinessDay(record));
  const scoped = employeeId === undefined
    ? []
    : all.filter((record) => record.operatorEmployeeId === employeeId);
  // This is a shared till. Never retain another employee's order envelope in
  // origin-wide storage, and never persist a manager's server-wide view.
  writeAll(scoped);
  return scoped;
};

export const saveOperationalOrdersForEmployee = (
  employeeId: number,
  records: OperationalOrderRecord[],
): void => {
  writeAll(records.filter((record) => record.operatorEmployeeId === employeeId));
};

export const saveOperationalOrdersForScope = (
  employeeId: number | undefined,
  records: OperationalOrderRecord[],
): void => {
  // Server-returned manager-wide rows are memory-only because they contain
  // customer PII for employees other than the signed-in manager.
  if (employeeId === undefined) return;
  saveOperationalOrdersForEmployee(employeeId, records);
};

const validTimestamp = (value: string): number => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const hongKongBusinessDate = (value: string | number | Date): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const isCurrentBusinessDay = (
  record: OperationalOrderRecord,
  now = Date.now(),
): boolean => hongKongBusinessDate(record.order.createdAt) === hongKongBusinessDate(now);

const normalizeLocalRecord = (record: OperationalOrderRecord): OperationalOrderRecord => ({
  ...record,
  order: {
    ...record.order,
    operatorEmployeeId: record.operatorEmployeeId,
  },
  retryEligible: record.retryEligible
    ?? record.syncState === "pending_odoo",
});

export const normalizeOperationalOrder = (
  row: OperationalOrderCollectionRow,
): OperationalOrderRecord => ({
  operationalOrderId: row.operationalOrderId,
  operatorEmployeeId: row.operatorEmployeeId,
  order: {
    ...row.order,
    operatorEmployeeId: row.operatorEmployeeId,
    odooOrderId: row.odooOrderId ?? row.order.odooOrderId ?? undefined,
    odooOrderName: row.odooOrderName ?? row.order.odooOrderName ?? undefined,
    odooInvoiceId: row.odooInvoiceId ?? row.order.odooInvoiceId ?? undefined,
    odooInvoiceName: row.odooInvoiceName ?? row.order.odooInvoiceName ?? undefined,
    odooPaymentId: row.odooPaymentId ?? row.order.odooPaymentId ?? undefined,
    odooPaymentName: row.odooPaymentName ?? row.order.odooPaymentName ?? undefined,
  },
  syncState: row.syncState,
  reviewError: row.reviewError,
  lastError: row.lastError,
  attemptCount: row.attemptCount,
  updatedAt: row.updatedAt,
  retryEligible: row.retryEligible,
});

export const mergeOperationalOrderSources = (
  serverRows: OperationalOrderCollectionRow[],
  localRecords: OperationalOrderRecord[],
  now = Date.now(),
): OperationalOrderRecord[] => {
  const merged = new Map<string, OperationalOrderRecord>();
  localRecords
    .map(normalizeLocalRecord)
    .filter((record) => isCurrent(record, now) && isCurrentBusinessDay(record, now))
    .forEach((record) => merged.set(record.operationalOrderId, record));
  serverRows
    .map(normalizeOperationalOrder)
    .filter((record) => isCurrentBusinessDay(record, now))
    .forEach((record) => merged.set(record.operationalOrderId, record));
  return [...merged.values()].sort(
    (left, right) => validTimestamp(right.updatedAt) - validTimestamp(left.updatedAt),
  );
};

export const applyOperationalOrderStatus = (
  records: OperationalOrderRecord[],
  status: OperationalOrderStatusResponse,
  updatedAt = new Date().toISOString(),
): OperationalOrderRecord[] => records.map((record) => (
  record.operationalOrderId !== status.operationalOrderId
    ? record
    : {
        ...record,
        syncState: status.syncState,
        reviewError: status.reviewError,
        lastError: status.lastError,
        attemptCount: status.attemptCount,
        updatedAt,
        retryEligible: false,
        order: {
          ...record.order,
          odooOrderId: status.odooOrderId ?? record.order.odooOrderId,
          odooOrderName: status.odooOrderName ?? record.order.odooOrderName,
        },
      }
));
