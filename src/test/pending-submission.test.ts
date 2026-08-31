import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearPendingSubmission,
  discardPendingSubmissionAfterOdooReview,
  deliveryContractFieldsForSubmission,
  employeeSnapshotForSubmission,
  firstAddedLegacyBusinessField,
  loadPendingSubmission,
  pendingOptionBindingsMatch,
  pendingRecipientBindingsMatch,
  pendingSubmissionBelongsToEmployee,
  pendingSubmissionForEmployee,
  PENDING_SUBMISSION_KEY,
  PENDING_SUBMISSION_TTL_MS,
  recipientBirthdayFieldForSubmission,
  savePendingSubmission,
  submissionPayloadMatches,
  submitPersistedOrder,
  upgradeLegacyPendingDeliverySelection,
  type PendingOrderSubmission,
} from "@/lib/pending-submission";
import { OdooApiError, OdooConflictError } from "@/lib/odoo-api";
import { normalizeDeliverySplitsForSubmission } from "@/lib/split-delivery";
import { recipientBirthdayStateFromSelection } from "@/lib/recipient-birthday";
import type { DeliverySplit, Order } from "@/types/order";

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
    savedAt: new Date().toISOString(),
  };
}

function buildLegacySplit(): DeliverySplit {
  return {
    id: "legacy-split-2",
    fulfillmentType: "delivery",
    deliveryDate: "2026-07-17",
    deliveryTimeMode: "specified",
    deliveryTime: "14:00",
    deliveryRegion: "香港島",
    deliveryDistrict: "中西區",
    deliveryArea: "中環",
    deliveryDetail: "Legacy address",
    deliveryAddress: "Legacy address",
    deliveryGoogleAddress: "Legacy address",
    deliveryBuilding: "",
    deliveryFloor: "",
    deliveryUnit: "",
    recipientType: "personal",
    recipientCompanyName: "",
    recipientName: "Legacy Recipient",
    recipientPhone: "61234567",
    deliveryPerson: "",
    failedDeliveryAction: "none",
    deliveryNote: "",
    itemAllocations: [{ itemId: "line-1", itemName: "Bouquet", quantity: 1 }],
  };
}

function buildPageOrderedDeliveryOrder(
  order: Order,
  selection: Pick<Order, "deliveryTimeMode" | "deliveryTime"> & Pick<Partial<Order>, "deliverySlotId">,
): Order {
  const entriesWithoutLegacyTime = Object.entries(order)
    .filter(([key]) => key !== "deliveryTime");
  return {
    ...Object.fromEntries(entriesWithoutLegacyTime),
    deliveryTimeMode: selection.deliveryTimeMode,
    ...(selection.deliverySlotId === undefined ? {} : { deliverySlotId: selection.deliverySlotId }),
    deliveryTime: selection.deliveryTime,
  } as Order;
}

describe("pending Odoo submission", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
    clearPendingSubmission();
  });

  afterAll(() => vi.unstubAllGlobals());

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

  it("uses immutable employee ID ownership even if the display label changes", () => {
    const pending = buildSubmission();
    pending.order.salesId = "AC02 — Elma";

    expect(pendingSubmissionBelongsToEmployee(pending, {
      id: 95,
      name: "Elma",
      login: "elma",
      salesLabel: "NEW-CODE — Elma Chan",
    })).toBe(true);
    expect(pendingSubmissionBelongsToEmployee(pending, {
      id: 96,
      name: "Another Cashier",
      login: "cashier-96",
      salesLabel: "odoo-96 — Another Cashier",
    })).toBe(false);

    delete pending.order.operatorEmployeeId;
    expect(pendingSubmissionBelongsToEmployee(pending, {
      id: 95,
      name: "Elma",
      login: "elma",
      salesLabel: "AC02 — Elma",
    })).toBe(false);
  });

  it("exposes a pending order for hydration and history only to its owning employee", () => {
    const pending = buildSubmission();
    pending.order.recipientType = "company";
    pending.order.recipientCompanyName = "Private Recipient Limited";
    pending.order.recipientName = "Private Contact";
    pending.order.recipientPhone = "61234567";
    pending.order.deliveryAddress = "Private delivery address";
    const owner = {
      id: 95,
      name: "Elma",
      login: "elma",
      salesLabel: "AC02 — Elma",
    };
    const otherEmployee = {
      id: 96,
      name: "Another Cashier",
      login: "cashier-96",
      salesLabel: "AC03 — Another Cashier",
    };

    expect(pendingSubmissionForEmployee(pending, owner)).toBe(pending);
    expect(pendingSubmissionForEmployee(pending, otherEmployee)).toBeNull();
    expect(pendingSubmissionForEmployee(pending, null)).toBeNull();
    expect(pendingSubmissionForEmployee(pending, null, false)).toBe(pending);
  });

  it("stores pending submissions independently for each employee", () => {
    const first = buildSubmission();
    const second = buildSubmission();
    second.order = {
      ...second.order,
      id: "9f714481-76fc-40d7-ab1f-3f5361795ea7",
      salesId: "AC03 — Another Cashier",
      operatorEmployeeId: 96,
    };

    savePendingSubmission(first);
    savePendingSubmission(second);

    expect(loadPendingSubmission({
      id: 95,
      name: "Elma",
      login: "elma",
      salesLabel: "AC02 — Elma",
    }, true)).toEqual(first);
    expect(loadPendingSubmission({
      id: 96,
      name: "Another Cashier",
      login: "cashier-96",
      salesLabel: "AC03 — Another Cashier",
    }, true)).toEqual(second);
  });

  it("clears only the submitting employee recovery record", async () => {
    const first = buildSubmission();
    const second = buildSubmission();
    second.order = {
      ...second.order,
      id: "9f714481-76fc-40d7-ab1f-3f5361795ea7",
      salesId: "AC03 — Another Cashier",
      operatorEmployeeId: 96,
    };
    savePendingSubmission(first);
    savePendingSubmission(second);

    await submitPersistedOrder(second, async () => ({ id: 502 }));

    expect(loadPendingSubmission({
      id: 95,
      name: "Elma",
      login: "elma",
      salesLabel: "AC02 — Elma",
    }, true)).toEqual(first);
    expect(loadPendingSubmission({
      id: 96,
      name: "Another Cashier",
      login: "cashier-96",
      salesLabel: "AC03 — Another Cashier",
    }, true)).toBeNull();
  });

  it("migrates a legacy envelope without exposing it to another employee", () => {
    const legacy = buildSubmission();
    localStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(legacy));

    expect(loadPendingSubmission({
      id: 96,
      name: "Another Cashier",
      login: "cashier-96",
      salesLabel: "AC03 — Another Cashier",
    }, true)).toBeNull();
    expect(loadPendingSubmission({
      id: 95,
      name: "Elma",
      login: "elma",
      salesLabel: "AC02 — Elma",
    }, true)).toEqual(legacy);
  });

  it("normalizes a malformed store by the employee recorded on the order", () => {
    const pending = buildSubmission();
    localStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify({
      version: 2,
      submissions: {
        "employee:96": pending,
      },
    }));

    expect(loadPendingSubmission({
      id: 96,
      name: "Another Cashier",
      login: "cashier-96",
      salesLabel: "AC03 — Another Cashier",
    }, true)).toBeNull();
    expect(loadPendingSubmission({
      id: 95,
      name: "Elma",
      login: "elma",
      salesLabel: "AC02 — Elma",
    }, true)).toEqual(pending);
  });

  it("expires stale recovery records", () => {
    const expired = buildSubmission();
    expired.savedAt = new Date(Date.now() - PENDING_SUBMISSION_TTL_MS - 1).toISOString();
    localStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(expired));

    expect(loadPendingSubmission()).toBeNull();
    expect(localStorage.getItem(PENDING_SUBMISSION_KEY)).toBeNull();
  });

  it("requires explicit confirmation before discarding only the local pending record", () => {
    const pending = buildSubmission();
    savePendingSubmission(pending);

    const employee = {
      id: 95,
      name: "Elma",
      login: "elma",
      salesLabel: "NEW-CODE — Elma Chan",
    };

    expect(() => discardPendingSubmissionAfterOdooReview(pending, employee, false)).toThrow("必須先確認");
    expect(loadPendingSubmission()).toEqual(pending);
    expect(discardPendingSubmissionAfterOdooReview(pending, employee, true)).toBe(true);
    expect(loadPendingSubmission()).toBeNull();
  });

  it("does not let another employee discard a pending submission", () => {
    const pending = buildSubmission();
    savePendingSubmission(pending);

    expect(() => discardPendingSubmissionAfterOdooReview(pending, {
      id: 96,
      name: "Another Cashier",
      login: "cashier-96",
      salesLabel: "AC03 — Another Cashier",
    }, true)).toThrow("原本落單員工");
    expect(loadPendingSubmission()).toEqual(pending);
  });

  it("allows confirmed local cleanup when POS authentication is disabled", () => {
    const pending = buildSubmission();
    savePendingSubmission(pending);

    expect(discardPendingSubmissionAfterOdooReview(
      pending,
      null,
      true,
      false,
    )).toBe(true);
    expect(loadPendingSubmission()).toBeNull();
  });

  it("keeps the original employee snapshot byte-stable for a same-ID retry", () => {
    const pending = buildSubmission();
    const snapshot = employeeSnapshotForSubmission(pending, {
      id: 95,
      name: "Elma Chan",
      login: "elma",
      salesLabel: "NEW-CODE — Elma Chan",
    }, {
      salesId: "NEW-CODE — Elma Chan",
      operatorEmployeeId: 95,
    });
    const retry = {
      ...pending,
      order: { ...pending.order, ...snapshot },
    };

    expect(snapshot).toEqual({
      salesId: "ACCOUNT - AC02 - Elma",
      operatorEmployeeId: 95,
    });
    expect(submissionPayloadMatches(pending, retry)).toBe(true);
  });

  it("replays salesperson, Sales Team, and Customer Group IDs exactly", () => {
    const pending = buildSubmission();
    Object.assign(pending.order, {
      salespersonEmployeeId: 96,
      salesTeamId: 7,
      customerGroupId: 12,
      customerGroupExpectedWriteDate: "2026-08-29 09:15:00",
      department: "Retail",
      customerGroup: "Corporate",
    });

    const snapshot = employeeSnapshotForSubmission(pending, {
      id: 95,
      name: "Elma",
      login: "elma",
      salesLabel: "AC02 — Elma",
    }, {
      salesId: "AC04 — Other",
      operatorEmployeeId: 95,
      salespersonEmployeeId: 97,
      salesTeamId: 8,
      customerGroupId: 13,
    });

    expect(snapshot).toEqual({
      salesId: "ACCOUNT - AC02 - Elma",
      operatorEmployeeId: 95,
      salespersonEmployeeId: 96,
      salesTeamId: 7,
      customerGroupId: 12,
    });
    expect(submissionPayloadMatches(pending, {
      ...pending,
      order: { ...pending.order, ...snapshot },
    })).toBe(true);
    expect(submissionPayloadMatches(pending, {
      ...pending,
      order: {
        ...pending.order,
        ...snapshot,
        customerGroupExpectedWriteDate: "2026-08-29 09:16:00",
      },
    })).toBe(false);
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

  it("unlocks a duplicate-phone customer conflict raised before order creation", async () => {
    const submission = buildSubmission();
    const submitter = vi.fn().mockRejectedValue(new OdooConflictError(
      "More than one Odoo customer has this phone number and contact name; select the customer explicitly.",
    ));

    await expect(submitPersistedOrder(submission, submitter)).rejects.toThrow(
      "More than one Odoo customer has this phone number",
    );
    expect(localStorage.getItem(PENDING_SUBMISSION_KEY)).toBeNull();
  });

  it("keeps an unrelated checkout conflict pending for manual Odoo review", async () => {
    const submission = buildSubmission();
    const submitter = vi.fn().mockRejectedValue(new OdooConflictError(
      "Duplicate Odoo checkout keys require administrator review.",
    ));

    await expect(submitPersistedOrder(submission, submitter)).rejects.toThrow(
      "Duplicate Odoo checkout keys require administrator review",
    );
    expect(loadPendingSubmission()?.order.id).toBe(submission.order.id);
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

  it("replays an old personal pending order without adding business snapshot fields", async () => {
    const pending = buildSubmission();
    savePendingSubmission(pending);
    const restored = loadPendingSubmission()!;
    const submitter = vi.fn().mockResolvedValue({ id: 501 });

    await submitPersistedOrder(restored, submitter);

    expect(submitter).toHaveBeenCalledWith(pending.order, pending.options);
    const replayedOrder = submitter.mock.calls[0][0] as Order;
    expect(replayedOrder).not.toHaveProperty("customerEmail");
    expect(replayedOrder).not.toHaveProperty("billingAddress");
    expect(replayedOrder).not.toHaveProperty("customerGroup");
    expect(replayedOrder).not.toHaveProperty("terms");
  });

  it("does not rewrite an old company pending order to add a billing address", () => {
    const pending = buildSubmission();
    pending.order.customerType = "company";
    pending.order.companyName = "Reload Test Limited";
    pending.options.customerType = "company";
    pending.options.companyName = "Reload Test Limited";
    savePendingSubmission(pending);
    const candidate: PendingOrderSubmission = {
      ...pending,
      order: {
        ...pending.order,
        customerType: "company",
        companyName: "Reload Test Limited",
        customerEmail: "accounts@example.com",
        billingAddress: "1 Flower Market Road",
        customerGroup: "",
        senderDoNumber: "",
        recipientDoNumber: "",
        sourceReference: "",
        department: "",
        terms: "",
        deliveryTimeMode: "specified",
      },
      options: {
        ...pending.options,
        customerType: "company",
        companyName: "Reload Test Limited",
      },
    };

    expect(() => savePendingSubmission(candidate)).toThrow("內容已改變");
    expect(loadPendingSubmission()).toEqual(pending);
    expect(loadPendingSubmission()?.order).not.toHaveProperty("billingAddress");
  });

  it("preserves a legacy raw company option during an exact pending replay", () => {
    const pending = buildSubmission();
    pending.order.customerType = "company";
    delete pending.order.companyName;
    pending.options.customerType = "company";
    pending.options.companyName = "  Reload Test Limited  ";
    savePendingSubmission(pending);

    const restored = loadPendingSubmission()!;
    const rebuilt = {
      ...restored,
      options: {
        ...restored.options,
        companyName: restored.options.companyName,
      },
    };

    expect(submissionPayloadMatches(restored, rebuilt)).toBe(true);
    expect(rebuilt.options.companyName).toBe("  Reload Test Limited  ");
  });

  it("rebuilds legacy pending splits byte-equally without injecting card or birthday fields", () => {
    const pending = buildSubmission();
    pending.order.deliverySplits = [buildLegacySplit()];
    const restored = JSON.parse(JSON.stringify(pending)) as PendingOrderSubmission;
    const rebuilt: PendingOrderSubmission = {
      ...restored,
      order: {
        ...restored.order,
        deliverySplits: normalizeDeliverySplitsForSubmission(
          restored.order.deliverySplits || [],
          { baselineSplits: restored.order.deliverySplits },
        ),
      },
    };

    expect(JSON.stringify(rebuilt.order.deliverySplits))
      .toBe(JSON.stringify(restored.order.deliverySplits));
    expect(rebuilt.order.deliverySplits?.[0]).not.toHaveProperty("giftCardEnabled");
    expect(rebuilt.order.deliverySplits?.[0]).not.toHaveProperty("giftCardMessage");
    expect(rebuilt.order.deliverySplits?.[0]).not.toHaveProperty("recipientBirthday");
    expect(rebuilt.order.deliverySplits?.[0]).not.toHaveProperty("recipientPartnerId");
    expect(submissionPayloadMatches(restored, rebuilt)).toBe(true);
  });

  it("omits a fresh D1 birthday when the bound recipient suggestion omitted the field", () => {
    const suggestion: { shippingPartnerId: number; recipientBirthday?: string | null } = {
      shippingPartnerId: 84,
    };
    const birthdayState = recipientBirthdayStateFromSelection(suggestion);

    expect(birthdayState).toEqual({ value: "", known: false });
    expect(recipientBirthdayFieldForSubmission(
      birthdayState.value,
      birthdayState.known,
    )).toEqual({});
  });

  it("also treats an explicit undefined D1 suggestion birthday as unknown", () => {
    const birthdayState = recipientBirthdayStateFromSelection({ recipientBirthday: undefined });

    expect(birthdayState).toEqual({ value: "", known: false });
    expect(recipientBirthdayFieldForSubmission(
      birthdayState.value,
      birthdayState.known,
    )).toEqual({});
  });

  it.each([null, ""] as const)(
    "serializes a fresh D1 explicit %s birthday as a clear",
    (recipientBirthday) => {
      const suggestion = { shippingPartnerId: 84, recipientBirthday };
      const birthdayState = recipientBirthdayStateFromSelection(suggestion);

      expect(birthdayState).toEqual({ value: "", known: true });
      expect(recipientBirthdayFieldForSubmission(
        birthdayState.value,
        birthdayState.known,
      )).toEqual({
        recipientBirthday: "",
      });
    },
  );

  it("serializes a cashier's manual D1 birthday clear", () => {
    const selectedBirthday = recipientBirthdayStateFromSelection({
      recipientBirthday: "1990-01-02",
    });

    expect(recipientBirthdayFieldForSubmission("", selectedBirthday.known)).toEqual({
      recipientBirthday: "",
    });
  });

  it("does not inject a D1 birthday into a legacy pending binding that omitted the field", () => {
    const pending = buildSubmission();
    pending.order.recipientPartnerId = 84;

    expect(recipientBirthdayFieldForSubmission("", false, pending.order)).toEqual({});
  });

  it("preserves an explicit D1 birthday clear when the pending baseline owns the field", () => {
    const pending = buildSubmission();
    pending.order.recipientPartnerId = 84;
    pending.order.recipientBirthday = "1990-01-02";

    expect(recipientBirthdayFieldForSubmission("", false, pending.order)).toEqual({
      recipientBirthday: "",
    });
  });

  it("keeps destination-owned data when it is added to a legacy pending split", () => {
    const pending = buildSubmission();
    pending.order.deliverySplits = [buildLegacySplit()];
    const editedSplits = [{
      ...pending.order.deliverySplits[0],
      giftCardEnabled: true,
      giftCardMessage: "New card must count as an edit",
      recipientBirthday: "1990-01-02",
      recipientPartnerId: 85,
    }];
    const rebuilt: PendingOrderSubmission = {
      ...pending,
      order: {
        ...pending.order,
        deliverySplits: normalizeDeliverySplitsForSubmission(editedSplits, {
          baselineSplits: pending.order.deliverySplits,
        }),
      },
    };

    expect(rebuilt.order.deliverySplits?.[0]).toMatchObject({
      giftCardEnabled: true,
      giftCardMessage: "New card must count as an edit",
      recipientBirthday: "1990-01-02",
      recipientPartnerId: 85,
    });
    expect(submissionPayloadMatches(pending, rebuilt)).toBe(false);
  });

  it("preserves independent split partner bindings through pending outbox submission", async () => {
    const pending = buildSubmission();
    pending.order.deliverySplits = normalizeDeliverySplitsForSubmission([
      { ...buildLegacySplit(), recipientPartnerId: 85 },
      { ...buildLegacySplit(), id: "legacy-split-3", recipientPartnerId: 86 },
    ]);
    const submitter = vi.fn().mockResolvedValue({ id: 501 });

    await submitPersistedOrder(pending, submitter);

    expect(submitter).toHaveBeenCalledWith(
      expect.objectContaining({
        deliverySplits: [
          expect.objectContaining({ id: "legacy-split-2", recipientPartnerId: 85 }),
          expect.objectContaining({ id: "legacy-split-3", recipientPartnerId: 86 }),
        ],
      }),
      pending.options,
    );
  });

  it("keeps a legacy pending split with a partner binding byte-equal when birthday was absent", () => {
    const pending = buildSubmission();
    pending.order.deliverySplits = [{ ...buildLegacySplit(), recipientPartnerId: 85 }];
    const restored = JSON.parse(JSON.stringify(pending)) as PendingOrderSubmission;
    const rebuilt: PendingOrderSubmission = {
      ...restored,
      order: {
        ...restored.order,
        deliverySplits: normalizeDeliverySplitsForSubmission(
          restored.order.deliverySplits || [],
          { baselineSplits: restored.order.deliverySplits },
        ),
      },
    };

    expect(JSON.stringify(rebuilt.order.deliverySplits))
      .toBe(JSON.stringify(restored.order.deliverySplits));
    expect(rebuilt.order.deliverySplits?.[0]).not.toHaveProperty("recipientBirthday");
    expect(submissionPayloadMatches(restored, rebuilt)).toBe(true);
  });

  it("detects a new field entered on an immutable legacy pending order", () => {
    const pending = buildSubmission();

    expect(firstAddedLegacyBusinessField(pending.order, {
      billingAddress: "1 Newly Entered Street",
    })).toBe("帳單地址");
    expect(firstAddedLegacyBusinessField(pending.order, {
      billingAddress: "",
      customerEmail: "",
    })).toBeNull();

    pending.order.billingAddress = "";
    expect(firstAddedLegacyBusinessField(pending.order, {
      billingAddress: "1 Newly Entered Street",
    })).toBeNull();
  });

  it("rejects customer option changes while preserving raw legacy options for replay", () => {
    const pending = buildSubmission();
    delete pending.order.customerType;
    delete pending.order.companyName;
    pending.options = {
      customerId: 42,
      customerType: "company",
      companyName: "  Reload Test Limited  ",
    };

    expect(pendingOptionBindingsMatch(pending, {
      customerId: 42,
      customerType: "company",
      companyName: "  Reload Test Limited  ",
    })).toBe(true);
    expect(pendingOptionBindingsMatch(pending, {
      customerId: 42,
      customerType: "personal",
      companyName: "",
    })).toBe(false);
    expect(pendingOptionBindingsMatch(pending, {
      customerId: 42,
      customerType: "company",
      companyName: "Edited Company",
    })).toBe(false);
    expect(pendingOptionBindingsMatch(pending, {
      customerId: 84,
      customerType: "company",
      companyName: "  Reload Test Limited  ",
    })).toBe(false);
  });

  it("locks recipient type and company identity while defaulting legacy retries to personal", () => {
    const legacy = buildSubmission();
    expect(pendingRecipientBindingsMatch(legacy, {
      recipientType: "personal",
      recipientCompanyName: "",
    })).toBe(true);
    expect(pendingRecipientBindingsMatch(legacy, {
      recipientType: "company",
      recipientCompanyName: "Recipient Limited",
    })).toBe(false);

    const company = buildSubmission();
    company.order.recipientType = "company";
    company.order.recipientCompanyName = "Recipient Limited";
    expect(pendingRecipientBindingsMatch(company, {
      recipientType: "company",
      recipientCompanyName: "Recipient Limited",
    })).toBe(true);
    expect(pendingRecipientBindingsMatch(company, {
      recipientType: "company",
      recipientCompanyName: "Edited Limited",
    })).toBe(false);
  });

  it("keeps legacy delivery contract keys absent when rebuilding a retry", () => {
    const pending = buildSubmission();

    expect(deliveryContractFieldsForSubmission("slot", 11, pending.order)).toEqual({});
  });

  it("upgrades a restored legacy delivery selection without changing checkout or payment IDs", async () => {
    const pending = buildSubmission();
    savePendingSubmission(pending);
    const restored = loadPendingSubmission();
    expect(restored).not.toBeNull();

    const upgraded = upgradeLegacyPendingDeliverySelection(restored!, {
      deliveryTimeMode: "slot",
      deliverySlotId: 11,
      deliveryTime: "上午 09:00-13:00",
    }, {
      ...restored!,
      order: buildPageOrderedDeliveryOrder(restored!.order, {
        deliveryTimeMode: "slot",
        deliverySlotId: 11,
        deliveryTime: "上午 09:00-13:00",
      }),
    });

    expect(upgraded).toEqual({
      ...restored,
      order: {
        ...restored!.order,
        deliveryTimeMode: "slot",
        deliverySlotId: 11,
        deliveryTime: "上午 09:00-13:00",
      },
    });
    expect(upgraded.order.id).toBe(pending.order.id);
    expect(upgraded.order.paymentIdempotencyKey).toBe(pending.order.paymentIdempotencyKey);
    expect(loadPendingSubmission()).toEqual(upgraded);

    const submitter = vi.fn().mockResolvedValue({ id: 501 });
    await expect(submitPersistedOrder(upgraded, submitter)).resolves.toEqual({ id: 501 });
    expect(submitter).toHaveBeenCalledWith(upgraded.order, upgraded.options);
    expect(localStorage.getItem(PENDING_SUBMISSION_KEY)).toBeNull();
  });

  it("keeps legacy drafts out of storage, upgrades once at submit, and then locks the payload", async () => {
    const original = buildSubmission();
    savePendingSubmission(original);
    const restored = loadPendingSubmission();
    expect(restored).not.toBeNull();

    const typedDrafts = ["上", "上午", "上午 10 時前"];
    expect(typedDrafts.at(-1)).toBe("上午 10 時前");
    const reloadedBeforeSubmit = loadPendingSubmission();
    expect(reloadedBeforeSubmit).toEqual(original);
    expect(reloadedBeforeSubmit?.order).not.toHaveProperty("deliveryTimeMode");

    const finalCandidate: PendingOrderSubmission = {
      ...restored!,
      order: buildPageOrderedDeliveryOrder(restored!.order, {
        deliveryTimeMode: "specified",
        deliveryTime: "上午 10 時前",
      }),
    };
    const upgraded = upgradeLegacyPendingDeliverySelection(restored!, {
      deliveryTimeMode: "specified",
      deliveryTime: "上午 10 時前",
    }, finalCandidate);

    expect(upgraded.order.deliveryTime).toBe("上午 10 時前");
    expect(upgraded.order.id).toBe(original.order.id);
    expect(upgraded.order.paymentIdempotencyKey).toBe(
      original.order.paymentIdempotencyKey,
    );
    expect(upgraded.order.customerName).toBe(original.order.customerName);
    expect(upgraded.order.items).toEqual(original.order.items);
    expect(upgraded.options).toEqual(original.options);
    expect(upgraded.savedAt).toBe(original.savedAt);
    expect(loadPendingSubmission()).toEqual(upgraded);

    const editedAfterUpgrade = {
      ...upgraded,
      order: { ...upgraded.order, deliveryTime: "上午 11 時前" },
    };
    expect(() => upgradeLegacyPendingDeliverySelection(upgraded, {
      deliveryTimeMode: "specified",
      deliveryTime: "上午 11 時前",
    }, editedAfterUpgrade)).toThrow("只適用於尚未提交");
    expect(loadPendingSubmission()).toEqual(upgraded);

    const submitter = vi.fn().mockResolvedValue({ id: 502 });
    await expect(submitPersistedOrder(upgraded, submitter)).resolves.toEqual({ id: 502 });
    expect(submitter).toHaveBeenCalledWith(upgraded.order, original.options);
    expect(localStorage.getItem(PENDING_SUBMISSION_KEY)).toBeNull();
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
