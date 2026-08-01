import { afterEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@/types/order";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("odoo-api note contracts", () => {
  it("loads typed delivery slots through the backend boundary", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const slots = [{
      id: 11,
      displayLabel: "上午 09:00-13:00",
      startTime: "09:00",
      endTime: "13:00",
    }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(slots));
    vi.stubGlobal("fetch", fetchMock);
    const { getDeliverySlots } = await import("@/lib/odoo-api");

    await expect(getDeliverySlots()).resolves.toEqual(slots);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/delivery-slots",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });

  it("does not fetch delivery slots when the local demo has no backend", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getDeliverySlots } = await import("@/lib/odoo-api");

    await expect(getDeliverySlots()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps search results lightweight until a customer is selected", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([{
      id: 42,
      name: "Alice",
      email: null,
      phone: "91234567",
      mobile: null,
      history_count: null,
      total_spent: null,
      history: [],
      tags: [],
      customerType: "company",
      companyName: "Alice Limited",
      billingAddress: "1 Flower Market Road",
    }])));
    const { searchOdooCustomers } = await import("@/lib/odoo-api");

    const [customer] = await searchOdooCustomers("Alice");

    expect(customer).toMatchObject({
      odooPartnerId: 42,
      name: "Alice",
      customerType: "company",
      companyName: "Alice Limited",
      billingAddress: "1 Flower Market Road",
      history: [],
    });
    expect(customer.historyCount).toBeUndefined();
    expect(customer.totalSpent).toBeUndefined();
  });

  it("uses the explicit Customer ID search mode and preserves the returned code", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{
      id: 42,
      name: "Alice",
      email: null,
      phone: "91234567",
      mobile: null,
      customerCode: "00-Ab/C",
      history_count: null,
      total_spent: null,
      history: [],
      tags: [],
    }]));
    vi.stubGlobal("fetch", fetchMock);
    const { searchOdooCustomers } = await import("@/lib/odoo-api");

    const [customer] = await searchOdooCustomers(
      " 00-aB/C ",
      undefined,
      "customer_code",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/customers?q=00-aB%2FC&searchType=customer_code",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
    expect(customer).toMatchObject({
      odooPartnerId: 42,
      customerCode: "00-Ab/C",
    });
  });

  it("raises a typed conflict error with the latest Odoo partner record", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const current = {
      partnerId: 42,
      commentText: "Changed in Odoo",
      tags: [{ id: 1, name: "VIP", managed: true }],
      writeDate: "2026-07-14 10:05:00",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      detail: {
        message: "The Odoo record changed since it was loaded.",
        current,
      },
    }, 409)));
    const { OdooConflictError, updateOdooPartnerNotes } = await import("@/lib/odoo-api");

    let caught: unknown;
    try {
      await updateOdooPartnerNotes(42, {
        commentText: "POS edit",
        expectedWriteDate: "2026-07-14 10:00:00",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(OdooConflictError);
    expect(caught).toMatchObject({ status: 409, latest: current });
  });

  it("submits the split notes and recipient partner without the legacy notes field", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      id: 7,
      name: "S00007",
      clientOrderRef: "POS-local-1",
      amountTotal: 500,
      partnerId: 42,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { submitOdooOrder } = await import("@/lib/odoo-api");
    const order: Order = {
      id: "local-1",
      salesId: "S001",
      operatorEmployeeId: 95,
      customerName: "Chan Tai",
      senderName: "Director Lee",
      phone: "9123 4567",
      customerType: "company",
      companyName: "Chan Tai Limited",
      customerEmail: "accounts@example.com",
      billingAddress: "1 Flower Market Road",
      customerGroup: "Corporate",
      senderDoNumber: "SDO-100",
      recipientDoNumber: "RDO-200",
      sourceReference: "PO-300",
      department: "Marketing",
      terms: "Net 30",
      items: [{
        id: "line-1",
        name: "Bouquet",
        price: 500,
        quantity: 1,
        packing: "Gift box",
        remarks: "White ribbon",
      }],
      deliveryFee: 0,
      urgentFee: 0,
      subtotal: 500,
      finalPrice: 500,
      priceOverridden: false,
      paymentStatus: "paid",
      depositAmount: 0,
      paymentMethod: "Cash",
      paymentReference: "CASH-001",
      paymentReceivedAt: "2026-07-14T10:00:00.000Z",
      paymentIdempotencyKey: "744078bd-ae57-4639-af5a-11d8805654b1",
      deliveryDate: "2026-07-15",
      deliveryTimeMode: "slot",
      deliverySlotId: 11,
      deliveryTime: "14:00",
      deliveryAddress: "Central",
      recipientType: "company",
      recipientCompanyName: "Recipient Limited",
      recipientName: "Lee",
      recipientPhone: "6000 0000",
      deliveryPerson: "Driver A",
      giftCardEnabled: false,
      giftCardMessage: "",
      senderNote: "Sender note",
      deliveryNote: "Delivery note",
      internalNote: "Internal note",
      customerNoteMutation: {
        commentText: "Customer long-term note",
        targetPartnerId: 42,
        expectedWriteDate: "2026-07-14 10:00:00",
      },
      recipientNoteMutation: { commentText: "Recipient long-term note" },
      recipientPartnerId: 84,
      notes: "legacy value must not be sent",
      createdAt: "2026-07-14T10:00:00.000Z",
    };

    await submitOdooOrder(order, {
      customerId: 42,
      customerType: "company",
      companyName: "Chan Tai Limited",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      senderName: "Director Lee",
      senderNote: "Sender note",
      deliveryNote: "Delivery note",
      internalNote: "Internal note",
      customerNoteMutation: {
        commentText: "Customer long-term note",
        targetPartnerId: 42,
        expectedWriteDate: "2026-07-14 10:00:00",
      },
      recipientNoteMutation: { commentText: "Recipient long-term note" },
      recipientPartnerId: 84,
      customerId: 42,
      operatorEmployeeId: 95,
      paymentReference: "CASH-001",
      paymentReceivedAt: "2026-07-14T10:00:00.000Z",
      paymentIdempotencyKey: "744078bd-ae57-4639-af5a-11d8805654b1",
      deliveryTimeMode: "slot",
      deliverySlotId: 11,
      recipientType: "company",
      recipientCompanyName: "Recipient Limited",
      customerType: "company",
      companyName: "Chan Tai Limited",
      customerEmail: "accounts@example.com",
      billingAddress: "1 Flower Market Road",
      customerGroup: "Corporate",
      senderDoNumber: "SDO-100",
      recipientDoNumber: "RDO-200",
      sourceReference: "PO-300",
      department: "Marketing",
      terms: "Net 30",
      items: [
        expect.objectContaining({
          packing: "Gift box",
          remarks: "White ribbon",
        }),
      ],
    });
    expect(payload).not.toHaveProperty("notes");
    expect(payload).not.toHaveProperty("followUpDate");
    expect(payload).not.toHaveProperty("reminderOption");
  });

  it("preserves structured recovery metadata from an ambiguous order failure", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const recovery = {
      localId: "local-ambiguous",
      runMarker: "TEST-E2E-AMBIGUOUS",
      orderId: 101,
      recipientId: 202,
      rollback: { complete: false, deleted: [], failed: ["sale.order:101"] },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      detail: { message: "Odoo API transport error.", recovery },
    }, 502)));
    const { OdooApiError, submitOdooOrder } = await import("@/lib/odoo-api");

    let caught: unknown;
    try {
      await submitOdooOrder({ id: "local-ambiguous" } as Order);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(OdooApiError);
    expect(caught).toMatchObject({ status: 502, recovery });
  });

  it("loads only backend-approved accounting payment options", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const options = [
      { code: "bank_in_fps", label: "Bank-in / FPS" },
      { code: "cash", label: "Cash" },
      { code: "card_terminal", label: "Card Terminal" },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(options));
    vi.stubGlobal("fetch", fetchMock);
    const { getAccountingPaymentOptions } = await import("@/lib/odoo-api");

    await expect(getAccountingPaymentOptions()).resolves.toEqual(options);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/accounting/payment-options",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } })
    );
  });

  it("loads the selected Hong Kong business day's Odoo order records", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const response = {
      date: "2026-07-19",
      generatedAt: "2026-07-19T13:00:00+08:00",
      truncated: false,
      orders: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);
    const { getOdooOrderRecords } = await import("@/lib/odoo-api");

    await expect(getOdooOrderRecords("2026-07-19")).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/orders?date=2026-07-19",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });
});
