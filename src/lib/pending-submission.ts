import type { DeliveryTimeMode, Order, RecipientType } from "@/types/order";
import type { PosEmployeeIdentity } from "@/lib/pos-auth";

type PosEmployeeScope = Omit<PosEmployeeIdentity, "role">
  & Partial<Pick<PosEmployeeIdentity, "role">>;

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
export const PENDING_SUBMISSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function recipientBirthdayFieldForSubmission(
  recipientBirthday: string,
  recipientBirthdayKnown: boolean,
  baselineOrder?: Pick<Order, "recipientBirthday">,
): Pick<Order, "recipientBirthday"> {
  const normalizedBirthday = recipientBirthday.trim();
  const baselineHasBirthday = Boolean(
    baselineOrder
    && Object.prototype.hasOwnProperty.call(baselineOrder, "recipientBirthday"),
  );
  if (normalizedBirthday || recipientBirthdayKnown || baselineHasBirthday) {
    return { recipientBirthday: normalizedBirthday };
  }
  return {};
}

interface PendingSubmissionStore {
  version: 2;
  submissions: Record<string, PendingOrderSubmission>;
}

const EMPTY_PENDING_STORE = (): PendingSubmissionStore => ({
  version: 2,
  submissions: {},
});

const submissionScopeKey = (pending: PendingOrderSubmission): string => {
  const employeeId = pending.order.operatorEmployeeId;
  return employeeId === undefined ? "anonymous" : `employee:${employeeId}`;
};

const employeeScopeKey = (employee: PosEmployeeScope): string => `employee:${employee.id}`;

function isPendingSubmission(value: unknown): value is PendingOrderSubmission {
  if (!value || typeof value !== "object") return false;
  const pending = value as Partial<PendingOrderSubmission>;
  return Boolean(
    pending.order?.id
      && pending.order.createdAt
      && pending.savedAt
      && (pending.order.paymentStatus === "unpaid" || pending.order.paymentIdempotencyKey),
  );
}

function isExpired(pending: PendingOrderSubmission, now = Date.now()): boolean {
  const savedAt = Date.parse(pending.savedAt);
  return !Number.isFinite(savedAt) || now - savedAt > PENDING_SUBMISSION_TTL_MS;
}

function persistStore(store: PendingSubmissionStore): void {
  if (Object.keys(store.submissions).length === 0) {
    localStorage.removeItem(PENDING_SUBMISSION_KEY);
    return;
  }
  localStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(store));
}

function readPendingStore(): PendingSubmissionStore {
  try {
    const raw = localStorage.getItem(PENDING_SUBMISSION_KEY);
    if (!raw) return EMPTY_PENDING_STORE();
    const parsed = JSON.parse(raw) as unknown;
    const store = EMPTY_PENDING_STORE();
    let shouldPersist = false;

    if (isPendingSubmission(parsed)) {
      // Migrate the original single-envelope format in place. Unknown legacy
      // ownership remains isolated under "anonymous" and cannot block a
      // signed-in employee.
      store.submissions[submissionScopeKey(parsed)] = parsed;
      shouldPersist = true;
    } else if (
      parsed
      && typeof parsed === "object"
      && (parsed as Partial<PendingSubmissionStore>).version === 2
      && (parsed as Partial<PendingSubmissionStore>).submissions
    ) {
      const candidates = (parsed as PendingSubmissionStore).submissions;
      for (const [scope, pending] of Object.entries(candidates)) {
        if (isPendingSubmission(pending) && !isExpired(pending)) {
          const normalizedScope = submissionScopeKey(pending);
          store.submissions[normalizedScope] = pending;
          if (normalizedScope !== scope) shouldPersist = true;
        } else {
          shouldPersist = true;
        }
      }
    } else {
      localStorage.removeItem(PENDING_SUBMISSION_KEY);
      return store;
    }

    if (Object.values(store.submissions).some((pending) => isExpired(pending))) {
      for (const [scope, pending] of Object.entries(store.submissions)) {
        if (isExpired(pending)) delete store.submissions[scope];
      }
      shouldPersist = true;
    }
    if (shouldPersist) persistStore(store);
    return store;
  } catch {
    localStorage.removeItem(PENDING_SUBMISSION_KEY);
    return EMPTY_PENDING_STORE();
  }
}

function pendingSubmissionForScope(
  store: PendingSubmissionStore,
  pending: PendingOrderSubmission,
): PendingOrderSubmission | null {
  return store.submissions[submissionScopeKey(pending)] || null;
}

export function pendingSubmissionBelongsToEmployee(
  pending: PendingOrderSubmission,
  employee: PosEmployeeScope,
): boolean {
  return pending.order.operatorEmployeeId !== undefined
    && pending.order.operatorEmployeeId === employee.id;
}

export function pendingSubmissionForEmployee(
  pending: PendingOrderSubmission | null,
  employee: PosEmployeeScope | null,
  authRequired = true,
): PendingOrderSubmission | null {
  if (!pending) return null;
  if (!authRequired) return pending;
  if (!employee || !pendingSubmissionBelongsToEmployee(pending, employee)) {
    return null;
  }
  return pending;
}

export function employeeSnapshotForSubmission(
  pending: PendingOrderSubmission | null,
  employee: PosEmployeeScope | null,
  current: Pick<
    Order,
    | "salesId"
    | "operatorEmployeeId"
    | "salespersonEmployeeId"
    | "salesTeamId"
    | "customerGroupId"
  >,
): Pick<
  Order,
  | "salesId"
  | "operatorEmployeeId"
  | "salespersonEmployeeId"
  | "salesTeamId"
  | "customerGroupId"
> {
  if (pending && employee && pendingSubmissionBelongsToEmployee(pending, employee)) {
    return {
      salesId: pending.order.salesId,
      operatorEmployeeId: pending.order.operatorEmployeeId,
      ...(Object.prototype.hasOwnProperty.call(pending.order, "salespersonEmployeeId")
        ? { salespersonEmployeeId: pending.order.salespersonEmployeeId }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(pending.order, "salesTeamId")
        ? { salesTeamId: pending.order.salesTeamId }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(pending.order, "customerGroupId")
        ? { customerGroupId: pending.order.customerGroupId }
        : {}),
    };
  }
  return current;
}

const BUSINESS_FIELD_LABELS = {
  customerCode: "Customer ID／客戶編號",
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

export function pendingRecipientBindingsMatch(
  pending: PendingOrderSubmission,
  current: {
    recipientType: RecipientType;
    recipientCompanyName: string;
  },
): boolean {
  const expectedCompanyName = pending.order.recipientCompanyName || "";
  const expectedRecipientType = pending.order.recipientType
    || (expectedCompanyName.trim() ? "company" : "personal");
  return current.recipientType === expectedRecipientType
    && current.recipientCompanyName === expectedCompanyName;
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

export function loadPendingSubmission(
  employee: PosEmployeeScope | null = null,
  authRequired = false,
): PendingOrderSubmission | null {
  const store = readPendingStore();
  if (authRequired) {
    return employee ? store.submissions[employeeScopeKey(employee)] || null : null;
  }
  if (employee) return store.submissions[employeeScopeKey(employee)] || null;
  return Object.values(store.submissions)[0] || null;
}

export function savePendingSubmission(submission: PendingOrderSubmission): void {
  const store = readPendingStore();
  const scope = submissionScopeKey(submission);
  const existing = store.submissions[scope];
  if (existing && existing.order.id !== submission.order.id) {
    throw new Error("目前員工有另一張 Odoo 訂單仍待確認，請先重試原本訂單");
  }
  if (existing && !submissionPayloadMatches(existing, submission)) {
    throw new Error("待確認嘅 Odoo 訂單內容已改變，請重新載入原本訂單");
  }
  store.submissions[scope] = submission;
  persistStore(store);
}

export function clearPendingSubmission(expected?: string | PendingOrderSubmission): boolean {
  const store = readPendingStore();
  if (!expected) {
    localStorage.removeItem(PENDING_SUBMISSION_KEY);
    return true;
  }

  if (typeof expected === "string") {
    const matchingScopes = Object.entries(store.submissions)
      .filter(([, pending]) => pending.order.id === expected)
      .map(([scope]) => scope);
    if (matchingScopes.length !== 1) return false;
    delete store.submissions[matchingScopes[0]];
  } else {
    const scope = submissionScopeKey(expected);
    const existing = store.submissions[scope];
    if (!existing || !submissionPayloadMatches(existing, expected)) {
      return false;
    }
    delete store.submissions[scope];
  }

  persistStore(store);
  return true;
}

export function discardPendingSubmissionAfterOdooReview(
  pending: PendingOrderSubmission,
  employee: PosEmployeeScope | null,
  confirmed: boolean,
  authRequired = true,
): boolean {
  if (
    authRequired
    && (!employee || !pendingSubmissionBelongsToEmployee(pending, employee))
  ) {
    throw new Error("只有原本落單員工先可以移除呢張本機待確認資料");
  }
  if (!confirmed) {
    throw new Error("必須先確認已到 Odoo 核對訂單，才可移除本機待確認資料");
  }
  return clearPendingSubmission(pending);
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

  const store = readPendingStore();
  const persisted = pendingSubmissionForScope(store, pending);
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
  store.submissions[submissionScopeKey(candidate)] = candidate;
  persistStore(store);
  return candidate;
}

export function isDeterministicSubmissionFailure(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error)) return false;
  const status = Number((error as { status?: unknown }).status);
  if (status === 400 || status === 422) return true;

  // This conflict is raised before Odoo creates an order. It is safe to
  // release the pending snapshot so staff can choose the correct customer or
  // amend the phone number and submit again. Other 409 responses can describe
  // an existing checkout and must continue to require manual Odoo review.
  return status === 409
    && error instanceof Error
    && error.message.includes("More than one Odoo customer has this phone number");
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
