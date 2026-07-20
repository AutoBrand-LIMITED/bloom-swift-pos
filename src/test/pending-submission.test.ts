import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearPendingSubmission,
  deliveryContractFieldsForSubmission,
  loadPendingSubmission,
  PENDING_SUBMISSION_KEY,
  savePendingSubmission,
  submissionPayloadMatches,
  submitPersistedOrder,
  type PendingOrderSubmission,
} from "@/lib/pending-submission";
import { OdooApiError } from "@/lib/odoo-api";
import type { Order } from "@/types/order";

function buildSubmission(): PendingOrderSubmission {
  const order: Order = {
    id: "43e81d2e-ccfb-415b-8799-12a2e7a528d4",
    salesId: "ACCOUNT - AC02 - Elma",
    operatorEmployeeId: 95,
    customerName: "Reload Test",
    senderName: "Reload Gift Sender",
    phone: "91234567",
    items: [{ id: "line-1", name: "Bouquet", price: 680, quantity: 1, productId: 4338 }],
    deliveryFee: 0,
    urgentFee: 0,
    subtotal: 680,
    finalPrice: 680,
    priceOverridden: false,
    paymentStatus: "paid",
    depositAmount: 0,
    paymentMethod: "bank_in_fps",
    paymentReference: "FPS-TEST-001",
    paymentReceivedAt: "2026-07-16T09:00:00+08:00",
    paymentIdempotencyKey: "744078bd-ae57-4639-af5a-11d8805654b1",
    deliveryDate: "2026-07-17",
    deliveryTime: "14:00",
    deliveryAddress: "Central, Hong Kong",
    recipientName: "Recipient",
    recipientPhone: "61234567",
    deliveryPerson: "Driver",
    giftCardEnabled: false,
    giftCardMessage: "",
    senderNote: "",
    deliveryNote: "",
    internalNote: "",
    customerNoteMutation: { commentText: "Deferred customer note" },
    recipientNoteMutation: { commentText: "Deferred recipient note" },
    createdAt: "2026-07-16T08:59:00+08:00",
  };
  return {
    order,
    options: { customerId: 42, customerType: "personal", companyName: "" },
    savedAt: "2026-07-16T09:00:00+08:00",
  };
}

describe("pending Odoo submission", () => {
  beforeEach(() => clearPendingSubmission());

  it("keeps the same checkout and payment keys after an ambiguous failure and reload", async () => {
    const submission = buildSubmission();
    const submitter = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(submitPersistedOrder(submission, submitter)).rejects.toThrow("Failed to fetch");
    const restoredAfterReload = loadPendingSubmission();

    expect(restoredAfterReload?.order.id).toBe(submission.order.id);
    expect(restoredAfterReload?.order.paymentIdempotencyKey).toBe(
      submission.order.paymentIdempotencyKey,
    );
    expect(restoredAfterReload?.order).toEqual(submission.order);
  });

  it("clears the envelope only after a confirmed response", async () => {
    const submission = buildSubmission();
    await submitPersistedOrder(submission, async () => ({ id: 501 }));
    expect(localStorage.getItem(PENDING_SUBMISSION_KEY)).toBeNull();
  });

  it("unlocks a rejected request when Odoo confirms a validation failure", async () => {
    const submission = buildSubmission();
    const submitter = vi.fn().mockRejectedValue(new OdooApiError("改價原因必填", 422));

    await expect(submitPersistedOrder(submission, submitter)).rejects.toThrow("改價原因必填");
    expect(localStorage.getItem(PENDING_SUBMISSION_KEY)).toBeNull();
  });

  it("keeps the envelope for server failures with an ambiguous write result", async () => {
    const submission = buildSubmission();
    const submitter = vi.fn().mockRejectedValue(new OdooApiError("Bad gateway", 502));

    await expect(submitPersistedOrder(submission, submitter)).rejects.toThrow("Bad gateway");
    expect(loadPendingSubmission()?.order.id).toBe(submission.order.id);
  });

  it("does not overwrite or clear a different unresolved checkout", () => {
    const first = buildSubmission();
    savePendingSubmission(first);
    const second = buildSubmission();
    second.order = { ...second.order, id: "9f714481-76fc-40d7-ab1f-3f5361795ea7" };

    expect(() => savePendingSubmission(second)).toThrow("仍待確認");
    expect(clearPendingSubmission(second.order.id)).toBe(false);
    expect(loadPendingSubmission()?.order.id).toBe(first.order.id);
  });

  it("does not overwrite or clear changed content under the same checkout ID", () => {
    const first = buildSubmission();
    savePendingSubmission(first);
    const changed = {
      ...first,
      order: { ...first.order, finalPrice: 1 },
    };

    expect(() => savePendingSubmission(changed)).toThrow("內容已改變");
    expect(clearPendingSubmission(changed)).toBe(false);
    expect(loadPendingSubmission()?.order.finalPrice).toBe(680);
  });

  it("detects visible edits before retrying the immutable payload", () => {
    const pending = buildSubmission();
    const edited = {
      ...pending,
      order: { ...pending.order, recipientPhone: "99999999" },
    };

    expect(submissionPayloadMatches(pending, pending)).toBe(true);
    expect(submissionPayloadMatches(pending, edited)).toBe(false);
  });

  it("keeps a legacy pending payload without inventing a sender field", () => {
    const pending = buildSubmission();
    delete pending.order.senderName;

    savePendingSubmission(pending);

    expect(loadPendingSubmission()?.order).not.toHaveProperty("senderName");
  });

  it("keeps legacy delivery contract keys absent when rebuilding a retry", () => {
    const pending = buildSubmission();

    expect(deliveryContractFieldsForSubmission("slot", 11, pending.order)).toEqual({});
  });

  it("retains present delivery contract keys so visible retry edits are detectable", () => {
    const pending = buildSubmission();
    pending.order.deliveryTimeMode = "slot";
    pending.order.deliverySlotId = 11;

    expect(deliveryContractFieldsForSubmission("specified", undefined, pending.order)).toEqual({
      deliveryTimeMode: "specified",
      deliverySlotId: undefined,
    });
  });

  it("adds only the mode key for a new specified-time submission", () => {
    expect(deliveryContractFieldsForSubmission("specified", undefined)).toEqual({
      deliveryTimeMode: "specified",
    });
  });
});
