import { beforeEach, describe, expect, it } from "vitest";

import {
  OPERATIONAL_ORDER_MAX_AGE_MS,
  OPERATIONAL_ORDERS_KEY,
  clearOperationalOrders,
  loadOperationalOrders,
  mergeOperationalOrderSources,
  normalizeOperationalOrder,
  saveOperationalOrdersForEmployee,
  type OperationalOrderRecord,
} from "@/lib/operational-orders";
import type { OperationalOrderCollectionRow } from "@/lib/odoo-api";
import type { Order } from "@/types/order";

const record = (
  operationalOrderId: string,
  operatorEmployeeId: number,
  updatedAt = new Date().toISOString(),
): OperationalOrderRecord => ({
  operationalOrderId,
  operatorEmployeeId,
  order: {
    id: operationalOrderId,
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
    deliveryDate: "2026-08-22",
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
    createdAt: updatedAt,
  } as Order,
  syncState: "pending_odoo",
  reviewError: null,
  lastError: null,
  attemptCount: 0,
  updatedAt,
  retryEligible: true,
});

beforeEach(() => {
  localStorage.clear();
});

describe("operational order display cache", () => {
  it("replaces shared-terminal storage with only the active employee scope", () => {
    saveOperationalOrdersForEmployee(1, [record("one", 1)]);
    saveOperationalOrdersForEmployee(2, [record("two", 2)]);

    expect(loadOperationalOrders(2).map(({ operationalOrderId }) => operationalOrderId))
      .toEqual(["two"]);
    expect(loadOperationalOrders(1)).toEqual([]);
  });

  it("never returns manager-wide cached envelopes and supports logout purge", () => {
    localStorage.setItem(OPERATIONAL_ORDERS_KEY, JSON.stringify([
      record("one", 1),
      record("two", 2),
    ]));

    expect(loadOperationalOrders()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(OPERATIONAL_ORDERS_KEY) || "[]")).toEqual([]);
    saveOperationalOrdersForEmployee(2, [record("two", 2)]);
    clearOperationalOrders();
    expect(localStorage.getItem(OPERATIONAL_ORDERS_KEY)).toBeNull();
  });

  it("purges stale browser copies because Supabase remains the source of truth", () => {
    const expired = new Date(Date.now() - OPERATIONAL_ORDER_MAX_AGE_MS - 1).toISOString();
    localStorage.setItem(OPERATIONAL_ORDERS_KEY, JSON.stringify([record("expired", 1, expired)]));

    expect(loadOperationalOrders(1)).toEqual([]);
    expect(JSON.parse(localStorage.getItem(OPERATIONAL_ORDERS_KEY) || "[]")).toEqual([]);
  });

  it("normalizes server Odoo references and signed operator ownership into the order", () => {
    const row: OperationalOrderCollectionRow = {
      ...record("server", 95, "2026-08-27T10:05:00+08:00"),
      order: {
        ...record("server", 1, "2026-08-27T10:00:00+08:00").order,
        customerName: "Cross-tablet customer",
      },
      retryEligible: false,
      syncState: "syncing",
      odooOrderId: 77,
      odooOrderName: "S00077",
      odooPartnerId: 42,
    };

    expect(normalizeOperationalOrder(row)).toMatchObject({
      operationalOrderId: "server",
      operatorEmployeeId: 95,
      retryEligible: false,
      order: {
        operatorEmployeeId: 95,
        customerName: "Cross-tablet customer",
        odooOrderId: 77,
        odooOrderName: "S00077",
      },
    });
  });

  it("hydrates server and same-day local fallback rows with server precedence and dedupe", () => {
    const now = Date.parse("2026-08-27T12:00:00+08:00");
    const staleLocalCopy = record("shared", 95, "2026-08-27T09:00:00+08:00");
    staleLocalCopy.order.customerName = "Stale local copy";
    const localOnly = record("local-only", 95, "2026-08-27T09:30:00+08:00");
    const previousDay = record("previous-day", 95, "2026-08-26T09:30:00+08:00");
    const serverRow: OperationalOrderCollectionRow = {
      ...record("shared", 95, "2026-08-27T10:00:00+08:00"),
      order: {
        ...staleLocalCopy.order,
        customerName: "Server copy",
      },
      lastError: "odoo_unavailable",
      attemptCount: 2,
      retryEligible: true,
      odooOrderId: null,
      odooOrderName: null,
      odooPartnerId: null,
    };

    expect(mergeOperationalOrderSources(
      [serverRow],
      [staleLocalCopy, localOnly, previousDay],
      now,
    )).toEqual([
      expect.objectContaining({
        operationalOrderId: "shared",
        attemptCount: 2,
        order: expect.objectContaining({ customerName: "Server copy" }),
      }),
      expect.objectContaining({ operationalOrderId: "local-only" }),
    ]);
  });
});
