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
  return JSON.stringify(pending.order) === JSON.stringify(candidate.order)
    && JSON.stringify(pending.options) === JSON.stringify(candidate.options);
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
