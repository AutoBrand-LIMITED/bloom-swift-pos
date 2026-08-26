import { describe, expect, it } from "vitest";
import {
  customerIdentityKey,
  extractCustomersFromOrders,
  normalizePurchasePaymentStatus,
} from "@/lib/customer-utils";

describe("customerIdentityKey", () => {
  it("keeps distinct Odoo partners separate even when their phone numbers match", () => {
    expect(customerIdentityKey({ id: "odoo-11", odooPartnerId: 11 })).not.toBe(
      customerIdentityKey({ id: "odoo-12", odooPartnerId: 12 })
    );
  });

  it("uses the local id for customers that have not synced to Odoo", () => {
    expect(customerIdentityKey({ id: "local-1" })).toBe("local:local-1");
  });
});

describe("normalizePurchasePaymentStatus", () => {
  it("only treats an explicit full-payment status as paid", () => {
    expect(normalizePurchasePaymentStatus("paid")).toBe("paid");
    expect(normalizePurchasePaymentStatus("settled")).toBe("paid");
    expect(normalizePurchasePaymentStatus(undefined)).toBe("unpaid");
    expect(normalizePurchasePaymentStatus("pending")).toBe("unpaid");
    expect(normalizePurchasePaymentStatus("unexpected")).toBe("unpaid");
  });

  it("preserves partial payments as deposits when extracting local orders", () => {
    const customers = extractCustomersFromOrders([{
      id: "order-1",
      phone: "61234567",
      customerName: "Test Customer",
      items: [],
      finalPrice: 100,
      paymentStatus: "deposit",
    } as Parameters<typeof extractCustomersFromOrders>[0][number]]);

    expect(customers[0]?.history[0]?.status).toBe("deposit");
  });
});
