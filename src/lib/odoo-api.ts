import type { CustomerTag, DemoCustomer, PurchaseRecord } from "@/data/demo-customers";
import type { Order, SalesStaff } from "@/types/order";
import { authenticatedFetch } from "@/lib/pos-auth";

interface OdooPartner {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  history_count: number | null;
  total_spent: number | null;
  history: PurchaseRecord[];
  commentText?: string;
  tags?: CustomerTag[];
  writeDate?: string | null;
}

interface OdooPartnerHistory {
  history_count: number;
  total_spent: number;
  history: PurchaseRecord[];
}

interface OdooEmployee {
  id: number;
  name: string;
  job_title: string | null;
  department_id: [number, string] | null;
  work_email: string | null;
  barcode: string | null;
}

interface OdooOrderResponse {
  id: number;
  name: string;
  clientOrderRef: string | null;
  amountTotal: number;
  partnerId: number;
  accounting?: {
    source: "odoo_accounting";
    idempotentReplay: boolean;
    invoice: { id: number; name: string };
    payment: { id: number; name: string } | null;
    amountReceivedMinor: number;
    amountResidualMinor: number;
  } | null;
}

export interface AccountingPaymentOption {
  code: string;
  label: string;
}

export interface DeliverySlot {
  id: number;
  displayLabel: string;
  startTime: string;
  endTime: string;
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
}

export interface OdooProductWritePayload {
  name: string;
  price: number;
  productCode?: string | null;
  categoryId?: number | null;
  barcode?: string | null;
  availableInPos: boolean;
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
  unsupportedReason: string | null;
}

export interface DayEndSummary {
  date: string;
  timezone: string;
  generatedAt: string;
  salesToday: DayEndSection;
  receivedForOtherDays: DayEndSection;
  totalMoneyReceived: number;
  summaryHash: string;
}

export interface OdooOrderRecordsResponse {
  date: string;
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
    detail?: string | {
      message?: string;
      current?: T;
      latest?: T;
      recovery?: OdooRecoveryMetadata;
    };
    message?: string;
    current?: T;
    latest?: T;
  } | null;
  const detail = body?.detail;
  const message =
    (typeof detail === "string" ? detail : detail?.message) ||
    body?.message ||
    fallback;

  if (res.status === 409) {
    const latest =
      (typeof detail === "object" ? detail?.current ?? detail?.latest : undefined) ??
      body?.current ??
      body?.latest;
    throw new OdooConflictError<T>(message, latest);
  }

  const recovery = typeof detail === "object" ? detail?.recovery : undefined;
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
  signal?: AbortSignal
): Promise<OdooProduct[]> {
  if (!BACKEND_URL) return [];

  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  params.set("limit", "180");

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
      customerType: options.customerType,
      companyName: options.companyName,
    }),
    signal,
  });

  if (!res.ok) {
    return throwApiError(res, `Odoo order sync failed: ${res.status}`);
  }

  return (await res.json()) as OdooOrderResponse;
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
  signal?: AbortSignal
): Promise<DemoCustomer[]> {
  const trimmed = query.trim();
  if (!BACKEND_URL || trimmed.length < 2) return [];

  const res = await authenticatedFetch(`${BACKEND_URL}/customers?q=${encodeURIComponent(trimmed)}`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Odoo customer search failed: ${res.status}`);
  }

  const partners = (await res.json()) as OdooPartner[];
  return partners.map((p) => ({
    id: `odoo-${p.id}`,
    odooPartnerId: p.id,
    name: p.name,
    phone: p.phone || p.mobile || "",
    history: p.history || [],
    historyCount: p.history_count ?? undefined,
    totalSpent: p.total_spent ?? undefined,
    commentText: p.commentText || "",
    tags: p.tags || [],
    writeDate: p.writeDate || undefined,
  }));
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
    history: data.history || [],
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

export async function getDayEndSummary(date: string, signal?: AbortSignal): Promise<DayEndSummary> {
  if (!BACKEND_URL) {
    throw new Error("Odoo backend is not configured");
  }

  const res = await authenticatedFetch(`${BACKEND_URL}/day-end/summary?date=${encodeURIComponent(date)}`, {
    headers: { "Content-Type": "application/json" },
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Day-end summary failed: ${res.status}`);
  }

  return (await res.json()) as DayEndSummary;
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
