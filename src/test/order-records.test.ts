import { beforeEach, describe, expect, it } from "vitest";

import {
  LEGACY_ORDERS_KEY,
  UNSYNCED_ORDER_MAX_AGE_MS,
  UNSYNCED_ORDERS_KEY,
  loadUnsyncedOrders,
  mergeOrderRecords,
  orderMatchesSearch,
  removeSyncedLocalOrders,
} from "@/lib/order-records";
import type { OperationalOrderRecord } from "@/lib/operational-orders";
import type { Order } from "@/types/order";

const order = (id: string, overrides: Partial<Order> = {}): Order => ({
  id,
  salesId: "S001",
  customerName: "Customer",
  phone: "91234567",
  items: [],
  deliveryFee: 0,
  urgentFee: 0,
  subtotal: 0,
  finalPrice: 100,
  priceOverridden: false,
  paymentStatus: "unpaid",
  depositAmount: 0,
  paymentMethod: "",
  deliveryDate: "2026-07-19",
  deliveryTime: "上午 09:00-13:00",
  deliveryAddress: "Central",
  recipientName: "Recipient",
  recipientPhone: "61234567",
  deliveryPerson: "",
  giftCardEnabled: false,
  giftCardMessage: "",
  senderNote: "",
  deliveryNote: "",
  internalNote: "",
  createdAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("order record sources", () => {
  it("lets the Odoo record win when the POS UUID matches", () => {
    const remote = order("same", { odooOrderId: 7, odooOrderName: "S00007" });
    const local = order("same");

    expect(mergeOrderRecords([remote], [local])).toEqual([
      expect.objectContaining({ id: "same", source: "odoo", syncState: "synced" }),
    ]);
  });

  it("keeps genuinely distinct orders even when amount and date match", () => {
    expect(mergeOrderRecords([order("one"), order("two")], [])).toHaveLength(2);
  });

  it("shows a durably accepted Supabase order while Odoo is pending", () => {
    const pendingOrder = order("operational-pending");
    const operational: OperationalOrderRecord = {
      operationalOrderId: pendingOrder.id,
      operatorEmployeeId: 17,
      order: pendingOrder,
      syncState: "pending_odoo",
      reviewError: null,
      lastError: "Odoo temporarily unavailable",
      attemptCount: 2,
      updatedAt: new Date().toISOString(),
      retryEligible: true,
    };

    expect(mergeOrderRecords([], [], null, [operational])).toEqual([
      expect.objectContaining({
        id: pendingOrder.id,
        source: "operational",
        syncState: "pending_odoo",
        operationalLastError: "Odoo temporarily unavailable",
      }),
    ]);
  });

  it("removes the temporary operational view when the Odoo record arrives", () => {
    const remote = order("same-operational", {
      odooOrderId: 77,
      odooOrderName: "S00077",
    });
    const operational: OperationalOrderRecord = {
      operationalOrderId: remote.id,
      operatorEmployeeId: 17,
      order: order(remote.id, { odooOrderId: 77, odooOrderName: "S00077" }),
      syncState: "synced",
      reviewError: null,
      lastError: null,
      attemptCount: 1,
      updatedAt: new Date().toISOString(),
      retryEligible: false,
    };

    expect(mergeOrderRecords([remote], [], null, [operational])).toEqual([
      expect.objectContaining({ id: remote.id, source: "odoo", syncState: "synced" }),
    ]);
  });

  it("keeps an unresolved operational row visible when Odoo has only a matching draft", () => {
    const remoteDraft = order("same-operational", {
      odooOrderId: 91,
      odooOrderName: "S00091",
    });
    const operational: OperationalOrderRecord = {
      operationalOrderId: "same-operational",
      operatorEmployeeId: 17,
      order: { ...remoteDraft },
      syncState: "needs_review",
      reviewError: "訂單需要管理員核對。",
      lastError: null,
      attemptCount: 1,
      updatedAt: new Date().toISOString(),
      retryEligible: false,
    };

    expect(mergeOrderRecords([remoteDraft], [], null, [operational])).toEqual([
      expect.objectContaining({
        id: "same-operational",
        source: "operational",
        syncState: "needs_review",
      }),
    ]);
  });

  it("shows an unresolved pending submission only once", () => {
    const pending = order("pending");
    const records = mergeOrderRecords([], [pending], pending);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ syncState: "pending_confirmation" });
  });

  it("lets the server operational row replace a duplicate local fallback", () => {
    const sharedOrder = order("shared");
    const operational: OperationalOrderRecord = {
      operationalOrderId: "operational-shared",
      operatorEmployeeId: 17,
      order: { ...sharedOrder, customerName: "Server operational copy" },
      syncState: "pending_odoo",
      reviewError: null,
      lastError: null,
      attemptCount: 0,
      updatedAt: new Date().toISOString(),
      retryEligible: true,
    };

    expect(mergeOrderRecords([], [sharedOrder], null, [operational])).toEqual([
      expect.objectContaining({
        id: "shared",
        customerName: "Server operational copy",
        source: "operational",
        operationalOrderId: "operational-shared",
      }),
    ]);
  });

  it("keeps accounting confirmation pending when Odoo already has the same POS UUID", () => {
    const pending = order("same");
    const remote = order("same", { odooOrderId: 7, odooOrderName: "S00007" });

    expect(mergeOrderRecords([remote], [], pending)).toEqual([
      expect.objectContaining({ source: "odoo", syncState: "pending_confirmation" }),
    ]);
  });

  it("uses the pending recovery payload instead of a stale local copy", () => {
    const pending = order("same", { customerName: "Latest customer" });
    const staleLocal = order("same", { customerName: "Stale customer" });

    expect(mergeOrderRecords([], [staleLocal], pending)).toEqual([
      expect.objectContaining({
        customerName: "Latest customer",
        source: "local",
        syncState: "pending_confirmation",
      }),
    ]);
  });

  it("removes local copies only after a matching Odoo record is returned", () => {
    const synced = order("same", { odooOrderId: 7, odooOrderName: "S00007" });
    const unsynced = order("local-only");

    expect(removeSyncedLocalOrders([synced], [order("same"), unsynced])).toEqual([unsynced]);
    expect(removeSyncedLocalOrders([], [order("same"), unsynced])).toHaveLength(2);
  });

  it("matches local orders by email, sender, delivery address, recipient, and formatted phone", () => {
    const record = order("searchable", {
      senderName: "Director Lee",
      customerEmail: "accounts@example.com",
      billingAddress: "1 Flower Market Road",
      deliveryAddress: "香港中環皇后大道 66 號",
      recipientCompanyName: "Recipient Limited",
      recipientName: "陳小姐",
      recipientPhone: "+852 6123 4567",
    });

    expect(orderMatchesSearch(record, "accounts@example.com")).toBe(true);
    expect(orderMatchesSearch(record, "director lee")).toBe(true);
    expect(orderMatchesSearch(record, "皇后大道")).toBe(true);
    expect(orderMatchesSearch(record, "Recipient Limited")).toBe(true);
    expect(orderMatchesSearch(record, "陳小姐")).toBe(true);
    expect(orderMatchesSearch(record, "61234567")).toBe(true);
    expect(orderMatchesSearch(record, "not present")).toBe(false);
  });

  it("matches local and operational orders by every secondary destination", () => {
    const record = order("split-searchable", {
      deliverySplits: [{
        id: "split-2",
        fulfillmentType: "delivery",
        deliveryDate: "2026-08-27",
        deliveryTimeMode: "specified",
        deliveryTime: "10:00",
        deliveryRegion: "九龍",
        deliveryDistrict: "觀塘區",
        deliveryArea: "觀塘",
        deliveryDetail: "Secondary Tower",
        deliveryAddress: "Secondary Tower, Kwun Tong",
        deliveryGoogleAddress: "Secondary Tower",
        deliveryBuilding: "Block B",
        deliveryFloor: "18",
        deliveryUnit: "A",
        recipientType: "company",
        recipientCompanyName: "Secondary Flowers Limited",
        recipientName: "Ms Secondary",
        recipientPhone: "+853 6333 4444",
        deliveryPerson: "",
        failedDeliveryAction: "none",
        deliveryNote: "",
        itemAllocations: [{ itemId: "line-1", itemName: "Bouquet", quantity: 1 }],
      }],
    });

    expect(orderMatchesSearch(record, "Secondary Flowers")).toBe(true);
    expect(orderMatchesSearch(record, "Secondary Tower")).toBe(true);
    expect(orderMatchesSearch(record, "63334444")).toBe(true);
  });

  it("migrates only unsynced legacy orders into durable local storage", () => {
    localStorage.setItem(LEGACY_ORDERS_KEY, JSON.stringify([
      order("local"),
      order("remote", { odooOrderId: 8, odooOrderName: "S00008" }),
    ]));

    expect(loadUnsyncedOrders().map(({ id }) => id)).toEqual(["local"]);
    expect(JSON.parse(localStorage.getItem(UNSYNCED_ORDERS_KEY) || "[]")).toHaveLength(1);
    expect(localStorage.getItem(LEGACY_ORDERS_KEY)).toBeNull();
  });

  it("derives a safe recipient type for legacy local records", () => {
    localStorage.setItem(UNSYNCED_ORDERS_KEY, JSON.stringify([
      order("legacy-personal"),
      order("legacy-company", { recipientCompanyName: "Recipient Limited" }),
    ]));

    const loaded = loadUnsyncedOrders();
    expect(loaded.find(({ id }) => id === "legacy-personal")).toMatchObject({
      recipientType: "personal",
      recipientCompanyName: "",
    });
    expect(loaded.find(({ id }) => id === "legacy-company")).toMatchObject({
      recipientType: "company",
      recipientCompanyName: "Recipient Limited",
    });
  });

  it("isolates malformed legacy storage", () => {
    localStorage.setItem(LEGACY_ORDERS_KEY, "not-json");
    expect(loadUnsyncedOrders()).toEqual([]);
  });

  it("purges expired unsynced order PII from durable browser storage", () => {
    const expired = order("expired", {
      createdAt: new Date(Date.now() - UNSYNCED_ORDER_MAX_AGE_MS - 1).toISOString(),
    });
    localStorage.setItem(UNSYNCED_ORDERS_KEY, JSON.stringify([expired]));

    expect(loadUnsyncedOrders()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(UNSYNCED_ORDERS_KEY) || "[]")).toEqual([]);
  });
});
