import type { CustomerTag, DemoCustomer, PurchaseRecord } from "@/data/demo-customers";
import type { DeliverySplit, OdooNamedReference, Order, RecipientOccasion, SalesStaff } from "@/types/order";
import { authenticatedFetch } from "@/lib/pos-auth";
import { normalizePurchasePaymentStatus } from "@/lib/customer-utils";
import { hasRecipientBirthdayField } from "@/lib/recipient-birthday";
import {
  hasRecipientOccasionsField,
  ownsRecipientOccasionsVersionField,
} from "@/lib/recipient-occasions";

type OdooPurchaseRecord = Omit<PurchaseRecord, "status"> & { status?: unknown };

interface OdooPartner {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  customerCode: string | null;
  customerType?: "personal" | "company";
  companyName?: string | null;
  billingAddress?: string | null;
  customerGroupId?: number | null;
  customerGroup?: string | null;
  recipientMatch?: {
    name: string | null;
    phone: string | null;
    resolved?: boolean;
    recipientType?: "personal" | "company";
    companyName?: string | null;
    recipientOccasions?: RecipientOccasion[] | null;
    recipientOccasionsVersion?: string | null;
    recipientBirthday?: string | null;
    deliveryAddress?: string | null;
    shippingPartnerId?: number | null;
  } | null;
  history_count: number | null;
  total_spent: number | null;
  history: OdooPurchaseRecord[];
  commentText?: string;
  tags?: CustomerTag[];
  writeDate?: string | null;
}

interface OdooPartnerHistory {
  history_count: number;
  total_spent: number;
  history: OdooPurchaseRecord[];
}

export interface CustomerAccountLookup {
  customerCode: string;
  contactCount: number;
  contacts: DemoCustomer[];
  truncated: boolean;
}

export type CustomerCodeMatchMode = "exact" | "prefix";

interface OdooEmployee {
  id: number;
  name: string;
  job_title: string | null;
  department_id: [number, string] | null;
  work_email: string | null;
  barcode: string | null;
}

export type OperationalOrderSyncState = "synced" | "pending_odoo" | "needs_review";

export type OperationalOrderStatusSyncState = OperationalOrderSyncState | "syncing";

export interface OdooOrderResponse {
  // These fields are present only when the backend durable checkout mode is enabled.
  operationalOrderId?: string | null;
  syncState?: OperationalOrderSyncState | null;
  reviewError?: string | null;
  id: number | null;
  name: string | null;
  clientOrderRef: string | null;
  amountTotal: number;
  partnerId: number | null;
  accounting?: {
    source: "odoo_accounting";
    idempotentReplay: boolean;
    invoice: { id: number; name: string };
    payment: { id: number; name: string } | null;
    amountReceivedMinor: number;
    amountResidualMinor: number;
  } | null;
}

export interface OperationalOrderStatusResponse {
  operationalOrderId: string;
  syncState: OperationalOrderStatusSyncState;
  odooOrderId: number | null;
  odooOrderName: string | null;
  odooPartnerId: number | null;
  reviewError: string | null;
  lastError: string | null;
  attemptCount: number;
}

export interface OperationalOrderCollectionRow {
  operationalOrderId: string;
  operatorEmployeeId: number;
  order: Order;
  syncState: OperationalOrderStatusSyncState;
  reviewError: string | null;
  lastError: string | null;
  attemptCount: number;
  updatedAt: string;
  retryEligible: boolean;
  odooOrderId?: number | null;
  odooOrderName?: string | null;
  odooPartnerId?: number | null;
  odooInvoiceId?: number | null;
  odooInvoiceName?: string | null;
  odooPaymentId?: number | null;
  odooPaymentName?: string | null;
}

export interface OperationalOrdersCollectionResponse {
  date: string;
  timezone: string;
  generatedAt: string;
  truncated: boolean;
  orders: OperationalOrderCollectionRow[];
}

export type SyncErrorStage =
  | "order_validation"
  | "sales_assignment"
  | "customer"
  | "recipient"
  | "recipient_important_dates"
  | "long_term_notes"
  | "delivery"
  | "odoo_connection"
  | "odoo_order"
  | "unknown";

export interface SyncErrorDiagnostic {
  code: string;
  stage: SyncErrorStage;
  title: string;
  reason: string;
  action: string;
  retryable: boolean;
}

export interface SyncErrorCenterOrder {
  operationalOrderId: string;
  traceId: string;
  posReference: string;
  acceptedAt: string;
  updatedAt: string;
  customerName: string;
  amountTotalMinor: number;
  syncState: "pending_odoo" | "syncing" | "needs_review";
  operatorEmployeeId: number | null;
  salespersonLabel: string | null;
  attemptCount: number;
  nextAttemptAt: string | null;
  retryEligible: boolean;
  recoveryEligible: boolean;
  diagnostic: SyncErrorDiagnostic;
}

export interface SyncErrorCenterResponse {
  generatedAt: string;
  summary: {
    pendingCount: number;
    syncingCount: number;
    needsReviewCount: number;
    unresolvedCount: number;
    unresolvedValueMinor: number;
    oldestAcceptedAt: string | null;
  };
  worker: {
    status: "unknown" | "running" | "succeeded" | "failed";
    lastStartedAt: string | null;
    lastCompletedAt: string | null;
    lastSuccessAt: string | null;
    lastClaimed: number;
    lastSynced: number;
    lastRetried: number;
    lastNeedsReview: number;
  };
  truncated: boolean;
  orders: SyncErrorCenterOrder[];
}

export type OperationalOrderRetryResponse = OperationalOrderStatusResponse;

export interface AccountingPaymentOption {
  code: string;
  label: string;
}

export interface OrderPaymentUpdate {
  amount: number;
  paymentMethod: string;
  paymentReference: string;
  paymentReceivedAt: string;
  paymentIdempotencyKey: string;
}

export interface OrderPaymentUpdateResponse {
  id: number;
  invoice: { id: number; name: string };
  payment: { id: number; name: string };
  amountReceivedMinor: number;
  amountResidualMinor: number;
  paymentStatus: "paid" | "deposit";
  writeDate: string;
  idempotentReplay: boolean;
}

export interface DeliverySlot {
  id: number;
  displayLabel: string;
  startTime: string;
  endTime: string;
}

export interface RecipientSuggestion {
  id: number;
  recipientType: "personal" | "company";
  recipientCompanyName: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientOccasions?: RecipientOccasion[] | null;
  recipientOccasionsVersion?: string | null;
  recipientBirthday?: string | null;
  deliveryAddress: string | null;
  shippingPartnerId: number | null;
  orderingCustomerId: number | null;
  orderingCustomerName: string | null;
  orderingCustomerPhone: string | null;
  orderingCustomerEmail: string | null;
  orderingCustomerBillingAddress: string | null;
}

export interface PartnerNoteRecord {
  partnerId: number;
  commentText: string;
  tags: CustomerTag[];
  writeDate: string;
}

export interface PartnerNoteUpdate {
  commentText: string;
  expectedWriteDate: string;
}

export interface OrderNoteRecord {
  orderId: number;
  senderNote: string;
  deliveryNote: string;
  internalNote: string;
  partnerId: number;
  recipientPartnerId: number | null;
  writeDate: string;
}

export interface OrderNoteUpdate {
  senderNote?: string;
  deliveryNote?: string;
  internalNote?: string;
  expectedWriteDate: string;
}

export interface OrderOperationalUpdate {
  /** Legacy snapshots are retained for old orders and safe display. */
  salesId: string;
  customerName: string;
  customerType: "personal" | "company";
  companyName: string;
  senderName: string;
  phone: string;
  customerEmail: string;
  billingAddress: string;
  customerGroup: string;
  senderDoNumber: string;
  recipientDoNumber: string;
  sourceReference: string;
  department: string;
  terms: string;
  fulfillmentType: "delivery" | "pickup";
  deliveryDate: string;
  deliveryTimeMode: "slot" | "specified";
  deliverySlotId?: number;
  deliveryTime: string;
  deliveryAddress: string;
  deliveryGoogleAddress: string;
  deliveryBuilding: string;
  deliveryFloor: string;
  deliveryUnit: string;
  deliverySplits?: DeliverySplit[];
  recipientType: "personal" | "company";
  recipientCompanyName: string;
  recipientName: string;
  recipientPhone: string;
  recipientPartnerId?: number;
  recipientOccasions?: RecipientOccasion[] | null;
  recipientOccasionsVersion?: string | null;
  recipientBirthday?: string;
  deliveryPerson: string;
  giftCardMessage: string;
  senderNote: string;
  deliveryNote: string;
  internalNote: string;
  expectedWriteDate: string;
}

export type OrderOperationalUpdatePayload = Omit<
  OrderOperationalUpdate,
  "salesId" | "department" | "customerGroup"
>;

export type OrderCustomerSectionUpdatePayload = Pick<
  OrderOperationalUpdate,
  | "customerName"
  | "customerType"
  | "companyName"
  | "senderName"
  | "phone"
  | "customerEmail"
  | "billingAddress"
  | "expectedWriteDate"
>;

export type OrderDeliverySectionUpdatePayload = Pick<
  OrderOperationalUpdate,
  | "fulfillmentType"
  | "deliveryDate"
  | "deliveryTimeMode"
  | "deliverySlotId"
  | "deliveryTime"
  | "deliveryAddress"
  | "deliveryGoogleAddress"
  | "deliveryBuilding"
  | "deliveryFloor"
  | "deliveryUnit"
  | "deliverySplits"
  | "recipientType"
  | "recipientCompanyName"
  | "recipientName"
  | "recipientPhone"
  | "recipientPartnerId"
  | "recipientOccasions"
  | "recipientOccasionsVersion"
  | "deliveryPerson"
  | "expectedWriteDate"
>;

export type OrderNotesSectionUpdatePayload = Pick<
  OrderOperationalUpdate,
  | "giftCardMessage"
  | "senderNote"
  | "deliveryNote"
  | "internalNote"
  | "expectedWriteDate"
>;

export type OrderSectionUpdate =
  | { section: "customer"; data: OrderCustomerSectionUpdatePayload }
  | { section: "delivery"; data: OrderDeliverySectionUpdatePayload }
  | { section: "notes"; data: OrderNotesSectionUpdatePayload };

export interface OrderOperationalUpdateResponse {
  id: number;
  writeDate: string;
}

export interface OdooOrderEditHistoryChange {
  field: string | null;
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface OdooOrderEditHistoryEntry {
  id: string | number;
  changedAt: string;
  operatorEmployeeId: number | null;
  operatorName: string;
  changes: OdooOrderEditHistoryChange[];
}

export interface OdooOrderEditHistory {
  orderId: number;
  entries: OdooOrderEditHistoryEntry[];
  truncated: boolean;
}

export class OdooConflictError<T = unknown> extends Error {
  readonly status = 409;
  readonly latest: T | undefined;

  constructor(message: string, latest?: T) {
    super(message);
    this.name = "OdooConflictError";
    this.latest = latest;
  }
}

export interface OdooRecoveryMetadata {
  localId?: string;
  runMarker?: string | null;
  orderId?: number | null;
  recipientId?: number | null;
  rollback?: {
    complete?: boolean;
    deleted?: Array<{ model: string; id: number }>;
    failed?: string[];
  };
}

export class OdooApiError extends Error {
  readonly status: number;
  readonly recovery: OdooRecoveryMetadata | undefined;

  constructor(message: string, status: number, recovery?: OdooRecoveryMetadata) {
    super(message);
    this.name = "OdooApiError";
    this.status = status;
    this.recovery = recovery;
  }
}

export interface OdooProduct {
  id: number;
  name: string;
  price: number;
  productCode: string | null;
  imageUrl: string;
  categoryId: number | null;
  categoryName: string | null;
  templateId: number | null;
  barcode: string | null;
  availableInPos: boolean;
  displaySequence: number;
  availableFrom: string | null;
  availableUntil: string | null;
}

export interface OdooProductWritePayload {
  name: string;
  price: number;
  productCode?: string | null;
  categoryId?: number | null;
  barcode?: string | null;
  availableInPos: boolean;
  displaySequence: number;
  availableFrom?: string | null;
  availableUntil?: string | null;
}

export interface OdooProductCategory {
  id: number;
  name: string;
  parent_id: [number, string] | null;
  sequence: number;
}

export interface DayEndPaymentBucket {
  key: string;
  label: string;
  amount: number;
  orderCount: number;
}

export interface DayEndPaymentRow {
  id: number;
  paymentName: string;
  paymentKey: string | null;
  checkoutKey: string;
  receivedAt: string;
  amount: number;
  paymentMethod: string | null;
  paymentBucket: string;
  paymentReference: string | null;
  operatorName: string | null;
  orderId: number | null;
  orderName: string | null;
  orderDate: string | null;
  invoiceReference: string | null;
  customerName: string | null;
}

export interface DayEndOrderRow {
  id: number;
  orderName: string;
  invoiceReference: string | null;
  posLocalId: string | null;
  dateOrder: string;
  customerName: string;
  salesperson: string | null;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentBucket: string;
  saleTotal: number;
  receivedToday: number;
  depositAmount: number;
  balanceAmount: number;
  remarks: string | null;
  deliveryDate: string | null;
  recipientType: "personal" | "company";
  recipientCompanyName: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  deliveryAddress: string | null;
}

export interface DayEndSection {
  label: string;
  orderCount: number;
  saleTotal: number;
  receivedTotal: number;
  averageSpend: number;
  buckets: DayEndPaymentBucket[];
  orders: DayEndOrderRow[];
  payments?: DayEndPaymentRow[];
  unsupportedReason: string | null;
}

interface DayEndSummaryBase {
  date: string;
  timezone: string;
  generatedAt: string;
}

export interface AvailableDayEndSummary extends DayEndSummaryBase {
  odooAvailable: true;
  salesToday: DayEndSection;
  receivedForOtherDays: DayEndSection;
  totalMoneyReceived: number;
  paymentBuckets?: DayEndPaymentBucket[];
  summaryHash: string;
}

export interface UnavailableDayEndSummary extends DayEndSummaryBase {
  odooAvailable: false;
  availabilityMessage: string;
  salesToday?: null;
  receivedForOtherDays?: null;
  totalMoneyReceived?: null;
  paymentBuckets?: null;
  summaryHash?: null;
}

export type DayEndSummary = AvailableDayEndSummary | UnavailableDayEndSummary;

export type ReceivablesStatus =
  | "all"
  | "overdue"
  | "due_today"
  | "not_due"
  | "missing_due_date";

export type ReceivableReconciliationStatus = "unreconciled" | "partially_reconciled";

export interface ReceivablesSummary {
  companyCurrencyId: number;
  companyCurrency: string;
  openInvoiceCount: number;
  openResidual: number;
  overdueInvoiceCount: number;
  overdueResidual: number;
  dueTodayInvoiceCount: number;
  dueTodayResidual: number;
  notDueInvoiceCount: number;
  notDueResidual: number;
  missingDueDateInvoiceCount: number;
  missingDueDateResidual: number;
}

export interface ReceivableInvoiceRow {
  id: number;
  invoiceNumber: string;
  reference: string | null;
  origin: string | null;
  invoiceDate: string;
  dueDate: string | null;
  paymentTermId: number | null;
  paymentTerm: string | null;
  customerId: number;
  customerName: string;
  salespersonId: number | null;
  salesperson: string | null;
  currencyId: number;
  currency: string;
  amountTotal: number;
  amountReconciled: number;
  amountResidual: number;
  companyCurrencyResidual: number;
  reconciliationStatus: ReceivableReconciliationStatus;
  status: Exclude<ReceivablesStatus, "all">;
  daysOverdue: number | null;
  daysUntilDue: number | null;
  overdueResidual: number;
  dueTodayResidual: number;
  notDueResidual: number;
  missingDueDateResidual: number;
}

export interface ReceivableInvoiceDetail {
  invoiceId: number;
  customerId: number;
  customerName: string;
  customerCompany: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  senderName: string | null;
  senderPhone: string | null;
  salesperson: string | null;
}

export interface ReceivablesResponse {
  snapshotVersion: string;
  generatedAt: string;
  asOfDate: string;
  timezone: string;
  summary: ReceivablesSummary;
  rows: ReceivableInvoiceRow[];
  totalRows: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ReceivablesQuery {
  status?: ReceivablesStatus;
  page?: number;
  limit?: number;
  refresh?: boolean;
  snapshotVersion?: string;
  signal?: AbortSignal;
}

export interface OdooOrderRecordsResponse {
  date?: string;
  generatedAt: string;
  truncated: boolean;
  orders: Order[];
}

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

export const hasOdooBackend = Boolean(BACKEND_URL);
export const allowLocalOnlyOrders = import.meta.env.DEV
  && import.meta.env.VITE_ALLOW_LOCAL_ONLY_ORDERS === "true";

async function throwApiError<T>(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null) as {
    detail?: string | Array<{
      loc?: Array<string | number>;
      msg?: string;
      type?: string;
    }> | {
      message?: string;
      current?: T;
      latest?: T;
      recovery?: OdooRecoveryMetadata;
    };
    message?: string;
    reviewError?: string;
    syncState?: OperationalOrderSyncState;
    operationalOrderId?: string;
    current?: T;
    latest?: T;
  } | null;
  const detail = body?.detail;
  const validationMessage = Array.isArray(detail)
    ? detail
      .map((issue) => {
        const field = issue.loc?.filter((part) => part !== "body").join(".");
        const reason = issue.msg?.trim();
        if (field && reason) return `${field}: ${reason}`;
        return reason || field || "";
      })
      .filter(Boolean)
      .join("；")
    : "";
  const baseMessage =
    (typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? validationMessage
        : detail?.message) ||
    body?.reviewError ||
    body?.message ||
    fallback;
  const traceId = res.headers.get("X-Trace-Id")?.trim();
  const message = traceId
    ? `${baseMessage}（追蹤編號：${traceId}）`
    : baseMessage;

  if (res.status === 409) {
    const latest =
      (detail && typeof detail === "object" && !Array.isArray(detail)
        ? detail.current ?? detail.latest
        : undefined) ??
      body?.current ??
      body?.latest;
    throw new OdooConflictError<T>(message, latest);
  }

  const recovery = detail && typeof detail === "object" && !Array.isArray(detail)
    ? detail.recovery
    : undefined;
  throw new OdooApiError(message, res.status, recovery);
}

export async function getOdooProducts(signal?: AbortSignal): Promise<OdooProduct[]> {
  if (!BACKEND_URL) return [];

  const res = await authenticatedFetch(`${BACKEND_URL}/products`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Odoo product sync failed: ${res.status}`);
  }

  return (await res.json()) as OdooProduct[];
}

export async function searchManageableOdooProducts(
  query = "",
  signal?: AbortSignal,
  categoryId?: number | null,
): Promise<OdooProduct[]> {
  if (!BACKEND_URL) return [];

  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (categoryId !== undefined && categoryId !== null) {
    params.set("category_id", String(categoryId));
  }
  params.set("limit", "300");

  const res = await authenticatedFetch(`${BACKEND_URL}/products/manage?${params.toString()}`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Odoo product management sync failed: ${res.status}`);
  }

  return (await res.json()) as OdooProduct[];
}

export async function reorderOdooProducts(
  products: Array<{ id: number; displaySequence: number }>,
): Promise<{ updated: number }> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await authenticatedFetch(`${BACKEND_URL}/products/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("儲存排序逾時，請稍後再試。系統未有確認排序變更。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Odoo product reorder failed: ${res.status}`);
  }

  return (await res.json()) as { updated: number };
}

export async function createOdooProduct(payload: OdooProductWritePayload): Promise<OdooProduct> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const res = await authenticatedFetch(`${BACKEND_URL}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Odoo product create failed: ${res.status}`);
  }

  return (await res.json()) as OdooProduct;
}

export async function updateOdooProduct(
  productId: number,
  payload: OdooProductWritePayload
): Promise<OdooProduct> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const res = await authenticatedFetch(`${BACKEND_URL}/products/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Odoo product update failed: ${res.status}`);
  }

  return (await res.json()) as OdooProduct;
}

export async function getOdooProductCategories(signal?: AbortSignal): Promise<OdooProductCategory[]> {
  if (!BACKEND_URL) return [];

  const res = await authenticatedFetch(`${BACKEND_URL}/categories`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Odoo category sync failed: ${res.status}`);
  }

  return (await res.json()) as OdooProductCategory[];
}

export async function submitOdooOrder(
  order: Order,
  options: { customerId?: number; customerType?: "personal" | "company"; companyName?: string } = {},
  signal?: AbortSignal
): Promise<OdooOrderResponse> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const { notes: _legacyNotes, ...orderPayload } = order;
  const res = await authenticatedFetch(`${BACKEND_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...orderPayload,
      customerId: options.customerId,
      customerType: options.customerType ?? order.customerType,
      companyName: options.companyName ?? order.companyName,
    }),
    signal,
  });

  if (res.status === 409) {
    const replay = await res.clone().json().catch(() => null) as OdooOrderResponse | null;
    if (replay?.syncState === "needs_review" && replay.operationalOrderId) {
      return replay;
    }
  }

  if (!res.ok) {
    return throwApiError(res, `Odoo order sync failed: ${res.status}`);
  }

  return (await res.json()) as OdooOrderResponse;
}

export async function getOperationalOrderStatus(
  operationalOrderId: string,
  signal?: AbortSignal,
): Promise<OperationalOrderStatusResponse> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }
  const res = await authenticatedFetch(
    `${BACKEND_URL}/orders/operational/${encodeURIComponent(operationalOrderId)}`,
    { headers: { "Content-Type": "application/json" }, signal },
  );
  if (!res.ok) {
    return throwApiError(res, `Operational order status failed: ${res.status}`);
  }
  return (await res.json()) as OperationalOrderStatusResponse;
}

export async function getOperationalOrders(
  signal?: AbortSignal,
): Promise<OperationalOrdersCollectionResponse> {
  if (!BACKEND_URL) {
    return {
      date: "",
      timezone: "Asia/Hong_Kong",
      generatedAt: "",
      truncated: false,
      orders: [],
    };
  }
  const res = await authenticatedFetch(`${BACKEND_URL}/orders/operational`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });
  if (!res.ok) {
    return throwApiError(res, `Operational order collection failed: ${res.status}`);
  }
  return (await res.json()) as OperationalOrdersCollectionResponse;
}

export async function getSyncErrorCenter(
  signal?: AbortSignal,
): Promise<SyncErrorCenterResponse> {
  if (!BACKEND_URL) {
    throw new OdooApiError("Odoo backend is not configured", 503);
  }
  const res = await authenticatedFetch(`${BACKEND_URL}/orders/operational/errors`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });
  if (!res.ok) {
    return throwApiError(res, `Sync diagnostics failed: ${res.status}`);
  }
  return (await res.json()) as SyncErrorCenterResponse;
}

export async function retryOperationalOrder(
  operationalOrderId: string,
  signal?: AbortSignal,
): Promise<OperationalOrderRetryResponse> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }
  const res = await authenticatedFetch(
    `${BACKEND_URL}/orders/operational/${encodeURIComponent(operationalOrderId)}/retry`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
    },
  );
  if (!res.ok) {
    return throwApiError(res, `Operational order retry failed: ${res.status}`);
  }
  return (await res.json()) as OperationalOrderRetryResponse;
}

export async function recoverOperationalOrder(
  operationalOrderId: string,
  signal?: AbortSignal,
): Promise<OperationalOrderRetryResponse> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }
  const res = await authenticatedFetch(
    `${BACKEND_URL}/orders/operational/${encodeURIComponent(operationalOrderId)}/recover`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
    },
  );
  if (!res.ok) {
    return throwApiError(res, `Operational order recovery failed: ${res.status}`);
  }
  return (await res.json()) as OperationalOrderRetryResponse;
}

export async function updateOdooOrderOperationalDetails(
  orderId: number,
  payload: OrderOperationalUpdatePayload,
  signal?: AbortSignal,
): Promise<OrderOperationalUpdateResponse> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  // Historical assignment fields are snapshots only. Never send them back to
  // the operational PATCH endpoint, which deliberately forbids reassignment.
  const {
    salesId: _salesId,
    department: _department,
    customerGroup: _customerGroup,
    operatorEmployeeId: _operatorEmployeeId,
    salespersonEmployeeId: _salespersonEmployeeId,
    salesTeamId: _salesTeamId,
    customerGroupId: _customerGroupId,
    customerGroupExpectedWriteDate: _customerGroupExpectedWriteDate,
    ...operationalPayload
  } = payload as OrderOperationalUpdatePayload & Record<string, unknown>;

  const res = await authenticatedFetch(`${BACKEND_URL}/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(operationalPayload),
    signal,
  });

  if (!res.ok) {
    return throwApiError<OrderOperationalUpdateResponse>(
      res,
      `Odoo order update failed: ${res.status}`,
    );
  }

  return (await res.json()) as OrderOperationalUpdateResponse;
}

export async function updateOdooOrderSection(
  orderId: number,
  update: OrderSectionUpdate,
  signal?: AbortSignal,
): Promise<OrderOperationalUpdateResponse> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const res = await authenticatedFetch(
    `${BACKEND_URL}/orders/${orderId}/sections/${update.section}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update.data),
      signal,
    },
  );

  if (!res.ok) {
    return throwApiError<OrderOperationalUpdateResponse>(
      res,
      `Odoo order ${update.section} update failed: ${res.status}`,
    );
  }

  return (await res.json()) as OrderOperationalUpdateResponse;
}

export async function recordOdooOrderPayment(
  orderId: number,
  payload: OrderPaymentUpdate,
  signal?: AbortSignal,
): Promise<OrderPaymentUpdateResponse> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const res = await authenticatedFetch(`${BACKEND_URL}/orders/${orderId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    return throwApiError<OrderPaymentUpdateResponse>(
      res,
      `Odoo payment update failed: ${res.status}`,
    );
  }

  return (await res.json()) as OrderPaymentUpdateResponse;
}

export async function getOdooOrderEditHistory(
  orderId: number,
  signal?: AbortSignal,
): Promise<OdooOrderEditHistory> {
  if (!BACKEND_URL) return { orderId, entries: [], truncated: false };

  const res = await authenticatedFetch(`${BACKEND_URL}/orders/${orderId}/history`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    return throwApiError<OdooOrderEditHistory>(
      res,
      `Odoo order edit history failed: ${res.status}`,
    );
  }

  return (await res.json()) as OdooOrderEditHistory;
}

export async function getAccountingPaymentOptions(signal?: AbortSignal): Promise<AccountingPaymentOption[]> {
  if (!BACKEND_URL) return [];

  const res = await authenticatedFetch(`${BACKEND_URL}/accounting/payment-options`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });
  if (!res.ok) {
    return throwApiError(res, `Odoo accounting readiness failed: ${res.status}`);
  }
  return (await res.json()) as AccountingPaymentOption[];
}

export async function getDeliverySlots(signal?: AbortSignal): Promise<DeliverySlot[]> {
  if (!BACKEND_URL) return [];

  const res = await authenticatedFetch(`${BACKEND_URL}/delivery-slots`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });
  if (!res.ok) {
    return throwApiError(res, `Odoo delivery slot sync failed: ${res.status}`);
  }
  return (await res.json()) as DeliverySlot[];
}

export async function searchOdooCustomers(
  query: string,
  signal?: AbortSignal,
  searchType: "general" | "customer_code" = "general",
  customerCodeMatchMode: CustomerCodeMatchMode = "exact",
): Promise<DemoCustomer[]> {
  const trimmed = query.trim();
  const minimumLength = searchType === "customer_code"
    ? customerCodeMatchMode === "prefix" ? 2 : 1
    : 2;
  if (!BACKEND_URL || trimmed.length < minimumLength) return [];

  const params = new URLSearchParams({ q: trimmed });
  if (searchType === "customer_code") {
    params.set("searchType", searchType);
    if (customerCodeMatchMode !== "exact") {
      params.set("matchMode", customerCodeMatchMode);
    }
  }
  const res = await authenticatedFetch(`${BACKEND_URL}/customers?${params.toString()}`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Odoo customer search failed: ${res.status}`);
  }

  const partners = (await res.json()) as OdooPartner[];
  return partners.map(mapOdooPartner);
}

export async function searchOdooCustomerAccount(
  code: string,
  signal?: AbortSignal,
): Promise<CustomerAccountLookup> {
  const trimmed = code.trim();
  if (!BACKEND_URL || !trimmed) {
    return { customerCode: trimmed, contactCount: 0, contacts: [], truncated: false };
  }

  const params = new URLSearchParams({ code: trimmed });
  const res = await authenticatedFetch(`${BACKEND_URL}/customer-accounts?${params.toString()}`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Odoo customer account search failed: ${res.status}`);
  }

  const account = (await res.json()) as {
    customerCode: string;
    contactCount: number;
    contacts: OdooPartner[];
    truncated: boolean;
  };
  return {
    customerCode: account.customerCode,
    contactCount: account.contactCount,
    contacts: account.contacts.map(mapOdooPartner),
    truncated: account.truncated,
  };
}

function mapOdooPartner(p: OdooPartner): DemoCustomer {
  const tags = p.tags || [];
  const customerGroupId = p.customerGroupId ?? undefined;
  const customerGroup = p.customerGroup?.trim()
    || (customerGroupId !== undefined
      ? tags.find((tag) => tag.id === customerGroupId)?.name
      : tags.map((tag) => tag.name.trim()).filter(Boolean).join(", "))
    || undefined;

  return {
    id: `odoo-${p.id}`,
    odooPartnerId: p.id,
    name: p.name,
    phone: p.phone || p.mobile || "",
    email: p.email || undefined,
    customerType: p.customerType || "personal",
    companyName: p.companyName || undefined,
    billingAddress: p.billingAddress || undefined,
    customerGroupId,
    customerGroup,
    customerCode: p.customerCode || undefined,
    history: normalizePurchaseRecords(p.history),
    historyCount: p.history_count ?? undefined,
    totalSpent: p.total_spent ?? undefined,
    commentText: p.commentText || "",
    tags,
    writeDate: p.writeDate || undefined,
    recipientMatch: p.recipientMatch
      ? {
          name: p.recipientMatch.name || undefined,
          phone: p.recipientMatch.phone || undefined,
          resolved: p.recipientMatch.resolved === true,
          recipientType: p.recipientMatch.recipientType || "personal",
          companyName: p.recipientMatch.companyName || undefined,
          ...(hasRecipientOccasionsField(p.recipientMatch)
            ? {
                recipientOccasions: p.recipientMatch.recipientOccasions ?? [],
                ...(ownsRecipientOccasionsVersionField(p.recipientMatch)
                  ? {
                      recipientOccasionsVersion:
                        p.recipientMatch.recipientOccasionsVersion,
                    }
                  : {}),
              }
            : hasRecipientBirthdayField(p.recipientMatch)
            ? { recipientBirthday: p.recipientMatch.recipientBirthday ?? null }
            : {}),
          deliveryAddress: p.recipientMatch.deliveryAddress || undefined,
          shippingPartnerId: p.recipientMatch.shippingPartnerId || undefined,
        }
      : undefined,
  };
}

function normalizePurchaseRecords(records?: OdooPurchaseRecord[]): PurchaseRecord[] {
  return (records || []).map((record) => ({
    ...record,
    status: normalizePurchasePaymentStatus(record.status),
  }));
}

export async function getOdooCustomer(
  partnerId: number,
  signal?: AbortSignal,
): Promise<DemoCustomer> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }
  const res = await authenticatedFetch(`${BACKEND_URL}/customers/${partnerId}`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });
  if (!res.ok) {
    return throwApiError<DemoCustomer>(res, `Odoo customer lookup failed: ${res.status}`);
  }
  return mapOdooPartner((await res.json()) as OdooPartner);
}

export async function searchOdooRecipients(
  query: string,
  signal?: AbortSignal,
): Promise<RecipientSuggestion[]> {
  const trimmed = query.trim();
  if (!BACKEND_URL || !trimmed) return [];

  const params = new URLSearchParams({ q: trimmed });
  const res = await authenticatedFetch(`${BACKEND_URL}/recipients?${params.toString()}`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });
  if (!res.ok) {
    return throwApiError<RecipientSuggestion[]>(
      res,
      `Odoo recipient search failed: ${res.status}`,
    );
  }
  return (await res.json()) as RecipientSuggestion[];
}

export async function getOdooPartnerNotes(
  partnerId: number,
  signal?: AbortSignal
): Promise<PartnerNoteRecord> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const res = await authenticatedFetch(`${BACKEND_URL}/customers/${partnerId}/notes`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    return throwApiError<PartnerNoteRecord>(res, `Odoo customer notes failed: ${res.status}`);
  }

  return (await res.json()) as PartnerNoteRecord;
}

export async function updateOdooPartnerNotes(
  partnerId: number,
  payload: PartnerNoteUpdate,
  signal?: AbortSignal
): Promise<PartnerNoteRecord> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const res = await authenticatedFetch(`${BACKEND_URL}/customers/${partnerId}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    return throwApiError<PartnerNoteRecord>(res, `Odoo customer note update failed: ${res.status}`);
  }

  return (await res.json()) as PartnerNoteRecord;
}

export async function getOdooCustomerTags(signal?: AbortSignal): Promise<CustomerTag[]> {
  if (!BACKEND_URL) return [];

  const res = await authenticatedFetch(`${BACKEND_URL}/customer-tags`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    return throwApiError<CustomerTag[]>(res, `Odoo customer tags failed: ${res.status}`);
  }

  return (await res.json()) as CustomerTag[];
}

export async function getOdooOrderNotes(
  orderId: number,
  signal?: AbortSignal
): Promise<OrderNoteRecord> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const res = await authenticatedFetch(`${BACKEND_URL}/orders/${orderId}/notes`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    return throwApiError<OrderNoteRecord>(res, `Odoo order notes failed: ${res.status}`);
  }

  return (await res.json()) as OrderNoteRecord;
}

export async function updateOdooOrderNotes(
  orderId: number,
  payload: OrderNoteUpdate,
  signal?: AbortSignal
): Promise<OrderNoteRecord> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const res = await authenticatedFetch(`${BACKEND_URL}/orders/${orderId}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    return throwApiError<OrderNoteRecord>(res, `Odoo order note update failed: ${res.status}`);
  }

  return (await res.json()) as OrderNoteRecord;
}

export async function getOdooCustomerHistory(
  partnerId: number,
  signal?: AbortSignal
): Promise<Pick<DemoCustomer, "history" | "historyCount" | "totalSpent">> {
  if (!BACKEND_URL) return { history: [], historyCount: 0, totalSpent: 0 };

  const res = await authenticatedFetch(`${BACKEND_URL}/customers/${partnerId}/history?refresh=true`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Odoo customer history failed: ${res.status}`);
  }

  const data = (await res.json()) as OdooPartnerHistory;
  return {
    history: normalizePurchaseRecords(data.history),
    historyCount: data.history_count,
    totalSpent: data.total_spent,
  };
}

export async function getOdooEmployees(signal?: AbortSignal): Promise<SalesStaff[]> {
  if (!BACKEND_URL) return [];

  const res = await authenticatedFetch(`${BACKEND_URL}/employees`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Odoo employee sync failed: ${res.status}`);
  }

  const employees = (await res.json()) as OdooEmployee[];
  const seen = new Set<string>();

  return employees.flatMap((employee) => {
    const code = employee.barcode?.trim() || null;
    const id = code || `odoo-${employee.id}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      name: employee.name,
      code,
      jobTitle: employee.job_title,
      odooEmployeeId: employee.id,
    }];
  });
}

export async function getOdooSalesTeams(signal?: AbortSignal): Promise<OdooNamedReference[]> {
  if (!BACKEND_URL) return [];

  const res = await authenticatedFetch(`${BACKEND_URL}/sales-teams`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });
  if (!res.ok) {
    return throwApiError<OdooNamedReference[]>(res, `Odoo sales teams failed: ${res.status}`);
  }
  return (await res.json()) as OdooNamedReference[];
}

export async function getOdooCustomerGroups(signal?: AbortSignal): Promise<OdooNamedReference[]> {
  if (!BACKEND_URL) return [];

  const res = await authenticatedFetch(`${BACKEND_URL}/customer-groups`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });
  if (!res.ok) {
    return throwApiError<OdooNamedReference[]>(res, `Odoo customer groups failed: ${res.status}`);
  }
  return (await res.json()) as OdooNamedReference[];
}

export async function getDayEndSummary(date: string, signal?: AbortSignal): Promise<DayEndSummary> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const res = await authenticatedFetch(`${BACKEND_URL}/day-end/summary?date=${encodeURIComponent(date)}`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  const body = await res.json().catch(() => null) as DayEndSummary | { detail?: string } | null;
  if (!res.ok && (!body || !("odooAvailable" in body) || body.odooAvailable !== false)) {
    throw new Error((body && "detail" in body ? body.detail : null) ?? `Day-end summary failed: ${res.status}`);
  }
  if (!body || !("odooAvailable" in body)) {
    throw new Error("Day-end summary returned an invalid availability response");
  }
  return body as DayEndSummary;
}

export async function getReceivables({
  status = "all",
  page = 1,
  limit = 50,
  refresh = false,
  snapshotVersion,
  signal,
}: ReceivablesQuery = {}): Promise<ReceivablesResponse> {
  if (!BACKEND_URL) {
    throw new OdooApiError("Odoo backend is not configured", 503);
  }

  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(limit),
    refresh: String(refresh),
  });
  if (snapshotVersion !== undefined && !refresh) {
    params.set("snapshot", snapshotVersion);
  }
  const res = await authenticatedFetch(`${BACKEND_URL}/accounting/receivables?${params.toString()}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    return throwApiError<ReceivablesResponse>(
      res,
      `Receivables request failed: ${res.status}`,
    );
  }

  return (await res.json()) as ReceivablesResponse;
}

export async function validateReceivablesAccess(signal?: AbortSignal): Promise<void> {
  if (!BACKEND_URL) {
    throw new OdooApiError("Odoo backend is not configured", 503);
  }

  const res = await authenticatedFetch(`${BACKEND_URL}/accounting/receivables/access`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    signal,
  });
  if (!res.ok) {
    return throwApiError<void>(
      res,
      `Receivables access validation failed: ${res.status}`,
    );
  }
}

export async function getReceivableDetail(
  invoiceId: number,
  signal?: AbortSignal,
): Promise<ReceivableInvoiceDetail> {
  if (!BACKEND_URL) {
    throw new OdooApiError("Odoo backend is not configured", 503);
  }

  const res = await authenticatedFetch(
    `${BACKEND_URL}/accounting/receivables/${encodeURIComponent(String(invoiceId))}/detail`,
    {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      signal,
    },
  );
  if (!res.ok) {
    return throwApiError<ReceivableInvoiceDetail>(
      res,
      `Receivable detail request failed: ${res.status}`,
    );
  }
  return (await res.json()) as ReceivableInvoiceDetail;
}

export async function getOdooOrderRecords(
  date: string,
  signal?: AbortSignal,
): Promise<OdooOrderRecordsResponse> {
  if (!BACKEND_URL) {
    return { date, generatedAt: "", truncated: false, orders: [] };
  }

  const res = await authenticatedFetch(`${BACKEND_URL}/orders?date=${encodeURIComponent(date)}`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    return throwApiError<OdooOrderRecordsResponse>(res, `Odoo order records failed: ${res.status}`);
  }

  return (await res.json()) as OdooOrderRecordsResponse;
}

export async function searchOdooOrderRecords(
  query: string,
  signal?: AbortSignal,
  date?: string,
): Promise<OdooOrderRecordsResponse> {
  const trimmed = query.trim();
  if (!BACKEND_URL || trimmed.length < 2) {
    return { ...(date ? { date } : {}), generatedAt: "", truncated: false, orders: [] };
  }

  const params = new URLSearchParams({ q: trimmed });
  if (date) params.set("date", date);
  const res = await authenticatedFetch(`${BACKEND_URL}/orders?${params.toString()}`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    return throwApiError<OdooOrderRecordsResponse>(res, `Odoo order search failed: ${res.status}`);
  }

  return (await res.json()) as OdooOrderRecordsResponse;
}
