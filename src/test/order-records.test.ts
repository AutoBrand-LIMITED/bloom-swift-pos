import { beforeEach, describe, expect, it } from "vitest";

import {
  LEGACY_ORDERS_KEY,
  UNSYNCED_ORDER_MAX_AGE_MS,
  UNSYNCED_ORDERS_KEY,
  loadUnsyncedOrders,
  mergeOrderRecords,
  removeSyncedLocalOrders,
} from "@/lib/order-records";
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

  it("shows an unresolved pending submission only once", () => {
    const pending = order("pending");
    const records = mergeOrderRecords([], [pending], pending);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ syncState: "pending_confirmation" });
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

  it("migrates only unsynced legacy orders into durable local storage", () => {
    localStorage.setItem(LEGACY_ORDERS_KEY, JSON.stringify([
      order("local"),
      order("remote", { odooOrderId: 8, odooOrderName: "S00008" }),
    ]));

    expect(loadUnsyncedOrders().map(({ id }) => id)).toEqual(["local"]);
    expect(JSON.parse(localStorage.getItem(UNSYNCED_ORDERS_KEY) || "[]")).toHaveLength(1);
    expect(localStorage.getItem(LEGACY_ORDERS_KEY)).toBeNull();
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
