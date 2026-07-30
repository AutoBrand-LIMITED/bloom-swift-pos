import type { DeliveryTimeMode, Order } from "@/types/order";

export interface PendingSubmissionOptions {
  customerId?: number;
  customerType?: "personal" | "company";
  companyName?: string;
}

export interface PendingOrderSubmission {
  order: Order;
  options: PendingSubmissionOptions;
  savedAt: string;
}

export const PENDING_SUBMISSION_KEY = "florist-pos-pending-odoo-submission-v1";

const BUSINESS_FIELD_LABELS = {
  customerEmail: "客戶電郵",
  billingAddress: "帳單地址",
  customerGroup: "客戶群組",
  senderDoNumber: "送花人 DO 編號",
  recipientDoNumber: "收花人 DO 編號",
  sourceReference: "客戶參考／PO 編號",
  department: "部門",
  terms: "條款",
} as const;

type BusinessField = keyof typeof BUSINESS_FIELD_LABELS;

export function firstAddedLegacyBusinessField(
  pendingOrder: Order,
  currentValues: Partial<Pick<Order, BusinessField>>,
): string | null {
  for (const [field, label] of Object.entries(BUSINESS_FIELD_LABELS) as [BusinessField, string][]) {
    if (
      !Object.prototype.hasOwnProperty.call(pendingOrder, field)
      && (currentValues[field] || "").trim()
    ) {
      return label;
    }
  }
  return null;
}

export function pendingOptionBindingsMatch(
  pending: PendingOrderSubmission,
  current: {
    customerId?: number;
    customerType: "personal" | "company";
    companyName: string;
  },
): boolean {
  const expectedCustomerType = pending.order.customerType
    || pending.options.customerType
    || "personal";
  const expectedCompanyName = pending.order.companyName
    || pending.options.companyName
    || "";
  return current.customerId === pending.options.customerId
    && current.customerType === expectedCustomerType
    && current.companyName === expectedCompanyName;
}

export function deliveryContractFieldsForSubmission(
  deliveryTimeMode: DeliveryTimeMode | undefined,
  deliverySlotId: number | undefined,
  pendingOrder?: Order,
): Partial<Pick<Order, "deliveryTimeMode" | "deliverySlotId">> {
  const includeMode = pendingOrder
    ? Object.prototype.hasOwnProperty.call(pendingOrder, "deliveryTimeMode")
    : deliveryTimeMode !== undefined;
  const includeSlotId = pendingOrder
    ? Object.prototype.hasOwnProperty.call(pendingOrder, "deliverySlotId")
    : deliveryTimeMode === "slot" && deliverySlotId !== undefined;

  return {
    ...(includeMode ? { deliveryTimeMode } : {}),
    ...(includeSlotId ? { deliverySlotId } : {}),
  };
}

export function loadPendingSubmission(): PendingOrderSubmission | null {
  try {
    const raw = localStorage.getItem(PENDING_SUBMISSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOrderSubmission;
    if (
      !parsed?.order?.id
      || !parsed.order.createdAt
      || !parsed.savedAt
      || (parsed.order.paymentStatus !== "unpaid" && !parsed.order.paymentIdempotencyKey)
    ) {
      localStorage.removeItem(PENDING_SUBMISSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(PENDING_SUBMISSION_KEY);
    return null;
  }
}

export function savePendingSubmission(submission: PendingOrderSubmission): void {
  const existing = loadPendingSubmission();
  if (existing && existing.order.id !== submission.order.id) {
    throw new Error("另一張 Odoo 訂單仍待確認，請先重試原本訂單");
  }
  if (existing && !submissionPayloadMatches(existing, submission)) {
    throw new Error("待確認嘅 Odoo 訂單內容已改變，請重新載入原本訂單");
  }
  localStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(submission));
}

export function clearPendingSubmission(expected?: string | PendingOrderSubmission): boolean {
  if (expected) {
    const existing = loadPendingSubmission();
    const expectedCheckoutId = typeof expected === "string" ? expected : expected.order.id;
    if (existing && existing.order.id !== expectedCheckoutId) return false;
    if (existing && typeof expected !== "string" && !submissionPayloadMatches(existing, expected)) {
      return false;
    }
  }
  localStorage.removeItem(PENDING_SUBMISSION_KEY);
  return true;
}

export function submissionPayloadMatches(
  pending: PendingOrderSubmission,
  candidate: PendingOrderSubmission,
): boolean {
  return valuesMatch(pending.order, candidate.order)
    && valuesMatch(pending.options, candidate.options);
}

function valuesMatch(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function orderWithoutDeliverySelection(order: Order): Record<string, unknown> {
  const comparable = { ...order } as Record<string, unknown>;
  delete comparable.deliveryTime;
  delete comparable.deliveryTimeMode;
  delete comparable.deliverySlotId;
  return comparable;
}

export function upgradeLegacyPendingDeliverySelection(
  pending: PendingOrderSubmission,
  selection: {
    deliveryTimeMode: DeliveryTimeMode;
    deliverySlotId?: number;
    deliveryTime: string;
  },
  candidate: PendingOrderSubmission,
): PendingOrderSubmission {
  const isLegacyDelivery = !Object.prototype.hasOwnProperty.call(
    pending.order,
    "deliveryTimeMode",
  ) && !Object.prototype.hasOwnProperty.call(pending.order, "deliverySlotId");
  if (!isLegacyDelivery) {
    throw new Error("送貨時間升級只適用於尚未提交嘅舊格式訂單");
  }
  if (!selection.deliveryTime.trim()) {
    throw new Error("重新選擇嘅送貨時間不可留空");
  }
  if (selection.deliveryTimeMode === "slot" && selection.deliverySlotId === undefined) {
    throw new Error("標準送貨時段必須包含時段編號");
  }
  if (selection.deliveryTimeMode === "specified" && selection.deliverySlotId !== undefined) {
    throw new Error("指定時間不可包含標準時段編號");
  }

  const persisted = loadPendingSubmission();
  if (!persisted || !submissionPayloadMatches(persisted, pending)) {
    throw new Error("待確認嘅 Odoo 訂單已改變，請重新載入後再選擇送貨時間");
  }

  const candidateMatchesSelection = candidate.order.deliveryTimeMode === selection.deliveryTimeMode
    && candidate.order.deliveryTime === selection.deliveryTime
    && (
      selection.deliveryTimeMode === "slot"
        ? candidate.order.deliverySlotId === selection.deliverySlotId
        : !Object.prototype.hasOwnProperty.call(candidate.order, "deliverySlotId")
    );
  const unchangedOutsideDelivery = valuesMatch(
    orderWithoutDeliverySelection(pending.order),
    orderWithoutDeliverySelection(candidate.order),
  ) && valuesMatch(pending.options, candidate.options)
    && pending.savedAt === candidate.savedAt;
  if (!candidateMatchesSelection || !unchangedOutsideDelivery) {
    throw new Error("待確認訂單除送貨時間外曾被修改；請還原原本內容後再重試");
  }
  localStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(candidate));
  return candidate;
}

export function isDeterministicSubmissionFailure(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error)) return false;
  const status = Number((error as { status?: unknown }).status);
  return status === 400 || status === 422;
}

export async function submitPersistedOrder<T>(
  submission: PendingOrderSubmission,
  submitter: (order: Order, options: PendingSubmissionOptions) => Promise<T>,
): Promise<T> {
  savePendingSubmission(submission);
  try {
    const result = await submitter(submission.order, submission.options);
    if (!clearPendingSubmission(submission)) {
      throw new Error("Odoo 已確認訂單，但本機待確認內容已改變；請重新載入後安全重試");
    }
    return result;
  } catch (error) {
    // Request validation happens before an Odoo order write. Release the
    // snapshot so staff can correct deterministic input errors and retry.
    if (isDeterministicSubmissionFailure(error)) {
      clearPendingSubmission(submission);
    }
    throw error;
  }
}
