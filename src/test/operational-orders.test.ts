import { beforeEach, describe, expect, it } from "vitest";

import {
  OPERATIONAL_ORDER_MAX_AGE_MS,
  OPERATIONAL_ORDERS_KEY,
  loadOperationalOrders,
  saveOperationalOrdersForEmployee,
  type OperationalOrderRecord,
} from "@/lib/operational-orders";
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
});

beforeEach(() => {
  localStorage.clear();
});

describe("operational order display cache", () => {
  it("keeps each employee's records isolated when saving", () => {
    saveOperationalOrdersForEmployee(1, [record("one", 1)]);
    saveOperationalOrdersForEmployee(2, [record("two", 2)]);

    expect(loadOperationalOrders(1).map(({ operationalOrderId }) => operationalOrderId))
      .toEqual(["one"]);
    expect(loadOperationalOrders(2).map(({ operationalOrderId }) => operationalOrderId))
      .toEqual(["two"]);
  });

  it("purges stale browser copies because Supabase remains the source of truth", () => {
    const expired = new Date(Date.now() - OPERATIONAL_ORDER_MAX_AGE_MS - 1).toISOString();
    localStorage.setItem(OPERATIONAL_ORDERS_KEY, JSON.stringify([record("expired", 1, expired)]));

    expect(loadOperationalOrders(1)).toEqual([]);
    expect(JSON.parse(localStorage.getItem(OPERATIONAL_ORDERS_KEY) || "[]")).toEqual([]);
  });
});
