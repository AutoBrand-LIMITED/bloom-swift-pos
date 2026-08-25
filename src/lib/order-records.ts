import type { Order } from "@/types/order";
import type { OperationalOrderRecord } from "@/lib/operational-orders";

export const LEGACY_ORDERS_KEY = "florist-pos-orders";
export const UNSYNCED_ORDERS_KEY = "florist-pos-unsynced-orders-v1";
export const UNSYNCED_ORDER_MAX_AGE_MS = 72 * 60 * 60 * 1000;

export type OrderRecordSource = "odoo" | "local" | "operational";
export type OrderRecordSyncState =
  | "synced"
  | "unsynced"
  | "pending_confirmation"
  | "pending_odoo"
  | "syncing"
  | "operational_synced"
  | "needs_review";

export type OrderRecordView = Order & {
  source: OrderRecordSource;
  syncState: OrderRecordSyncState;
  operationalReviewError?: string | null;
  operationalLastError?: string | null;
};

const isOrder = (value: unknown): value is Order => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Order>;
  return typeof candidate.id === "string"
    && typeof candidate.createdAt === "string"
    && Array.isArray(candidate.items);
};

const readOrders = (storage: Storage, key: string): Order[] => {
  try {
    const value = JSON.parse(storage.getItem(key) || "[]") as unknown;
    return Array.isArray(value) ? value.filter(isOrder) : [];
  } catch {
    return [];
  }
};

const normalizeLegacyOrder = (order: Order): Order => ({
  ...order,
  senderName: order.senderName ?? order.customerName ?? "",
  senderNote: order.senderNote ?? "",
  deliveryNote: order.deliveryNote ?? "",
  internalNote: order.internalNote ?? order.notes ?? "",
  recipientType: order.recipientType
    ?? (order.recipientCompanyName?.trim() ? "company" : "personal"),
  recipientCompanyName: order.recipientCompanyName ?? "",
});

const localIdentity = (order: Order) => order.id;

const ordersMatch = (left: Order, right: Order) => (
  left.id === right.id
  || Boolean(left.odooOrderId && right.odooOrderId && left.odooOrderId === right.odooOrderId)
  || Boolean(left.odooOrderName && right.odooOrderName && left.odooOrderName === right.odooOrderName)
);

const isRecoverable = (order: Order, now = Date.now()) => {
  const createdAt = Date.parse(order.createdAt);
  return Number.isFinite(createdAt)
    && createdAt <= now
    && now - createdAt <= UNSYNCED_ORDER_MAX_AGE_MS;
};

export const orderMatchesSearch = (order: Order, query: string): boolean => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;
  const values = [
    order.odooOrderName,
    order.id,
    order.customerName,
    order.senderName,
    order.phone,
    order.customerEmail,
    order.billingAddress,
    order.deliveryAddress,
    order.recipientCompanyName,
    order.recipientName,
    order.recipientPhone,
    ...(order.deliverySplits || []).flatMap((split) => [
      split.recipientCompanyName,
      split.recipientName,
      split.recipientPhone,
      split.deliveryAddress,
      split.deliveryGoogleAddress,
      split.deliveryBuilding,
      split.deliveryFloor,
      split.deliveryUnit,
    ]),
  ];
  if (values.some((value) => value?.toLocaleLowerCase().includes(normalizedQuery))) return true;

  const queryDigits = normalizedQuery.replace(/\D/g, "");
  if (queryDigits.length < 4) return false;
  return [
    order.phone,
    order.recipientPhone,
    ...(order.deliverySplits || []).map((split) => split.recipientPhone),
  ].some((value) => (
    value?.replace(/\D/g, "").includes(queryDigits)
  ));
};

export const saveUnsyncedOrders = (orders: Order[]): void => {
  localStorage.setItem(UNSYNCED_ORDERS_KEY, JSON.stringify(orders));
};

export const loadUnsyncedOrders = (): Order[] => {
  const stored = readOrders(localStorage, UNSYNCED_ORDERS_KEY).map(normalizeLegacyOrder);
  const existing = stored.filter((order) => isRecoverable(order));
  const legacy = [
    ...readOrders(localStorage, LEGACY_ORDERS_KEY),
    ...readOrders(sessionStorage, LEGACY_ORDERS_KEY),
    ]
    .map(normalizeLegacyOrder)
    .filter((order) => isRecoverable(order))
    .filter((order) => !order.odooOrderId && !order.odooOrderName);

  const merged = new Map(existing.map((order) => [localIdentity(order), order]));
  legacy.forEach((order) => merged.set(localIdentity(order), order));
  const orders = [...merged.values()];

  if (legacy.length > 0 || existing.length !== stored.length) saveUnsyncedOrders(orders);
  localStorage.removeItem(LEGACY_ORDERS_KEY);
  sessionStorage.removeItem(LEGACY_ORDERS_KEY);
  return orders;
};

const validTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const mergeOrderRecords = (
  remoteOrders: Order[],
  localOrders: Order[],
  pendingOrder?: Order | null,
  operationalOrders: OperationalOrderRecord[] = [],
): OrderRecordView[] => {
  const remoteByOdooId = new Set<number>();
  const remoteByOdooName = new Set<string>();
  const remoteByLocalId = new Set<string>();
  const remote: OrderRecordView[] = [];

  for (const order of remoteOrders) {
    if (order.odooOrderId && remoteByOdooId.has(order.odooOrderId)) continue;
    if (order.odooOrderName && remoteByOdooName.has(order.odooOrderName)) continue;
    if (remoteByLocalId.has(order.id)) continue;
    if (order.odooOrderId) remoteByOdooId.add(order.odooOrderId);
    if (order.odooOrderName) remoteByOdooName.add(order.odooOrderName);
    remoteByLocalId.add(order.id);
    remote.push({
      ...order,
      source: "odoo",
      syncState: pendingOrder && ordersMatch(order, pendingOrder)
        ? "pending_confirmation"
        : "synced",
    });
  }

  const localCandidates = pendingOrder
    ? [pendingOrder, ...localOrders]
    : [...localOrders];
  const seenLocal = new Set<string>();
  const local: OrderRecordView[] = [];
  for (const order of localCandidates) {
    if (seenLocal.has(order.id)) continue;
    seenLocal.add(order.id);
    const remoteMatch = remoteByLocalId.has(order.id)
      || Boolean(order.odooOrderId && remoteByOdooId.has(order.odooOrderId))
      || Boolean(order.odooOrderName && remoteByOdooName.has(order.odooOrderName));
    if (remoteMatch) continue;
    local.push({
      ...order,
      source: "local",
      syncState: pendingOrder?.id === order.id ? "pending_confirmation" : "unsynced",
    });
  }

  const operational: OrderRecordView[] = [];
  for (const record of operationalOrders) {
    const order = record.order;
    const remoteMatch = remoteByLocalId.has(order.id)
      || Boolean(order.odooOrderId && remoteByOdooId.has(order.odooOrderId))
      || Boolean(order.odooOrderName && remoteByOdooName.has(order.odooOrderName));
    if (remoteMatch || seenLocal.has(order.id)) continue;
    operational.push({
      ...order,
      source: "operational",
      syncState: record.syncState === "synced" ? "operational_synced" : record.syncState,
      operationalReviewError: record.reviewError,
      operationalLastError: record.lastError,
    });
  }

  return [...remote, ...operational, ...local].sort((left, right) => {
    const dateDifference = validTimestamp(right.createdAt) - validTimestamp(left.createdAt);
    if (dateDifference) return dateDifference;
    if (left.source !== right.source) return left.source === "odoo" ? -1 : 1;
    return left.id.localeCompare(right.id);
  });
};

export const removeSyncedLocalOrders = (
  remoteOrders: Order[],
  localOrders: Order[],
): Order[] => localOrders.filter(
  (localOrder) => !remoteOrders.some((remoteOrder) => ordersMatch(remoteOrder, localOrder)),
);

export const hongKongBusinessDate = (date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};
