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
      recipientMatch: {
        name: "Mary Wong",
        phone: "6111 1111",
        resolved: true,
        recipientType: "company",
        companyName: "Mary Flowers Limited",
        deliveryAddress: "6 How Ming Street",
        shippingPartnerId: 45,
      },
    }])));
    const { searchOdooCustomers } = await import("@/lib/odoo-api");

    const [customer] = await searchOdooCustomers("Alice");

    expect(customer).toMatchObject({
      odooPartnerId: 42,
      name: "Alice",
      customerType: "company",
      companyName: "Alice Limited",
      billingAddress: "1 Flower Market Road",
      recipientMatch: {
        name: "Mary Wong",
        phone: "6111 1111",
        resolved: true,
        recipientType: "company",
        companyName: "Mary Flowers Limited",
        deliveryAddress: "6 How Ming Street",
        shippingPartnerId: 45,
      },
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

  it("searches historical recipients from a single phone digit", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const suggestions = [{
      id: 90,
      recipientType: "personal",
      recipientCompanyName: null,
      recipientName: "Ms Gift",
      recipientPhone: "6123 4567",
      deliveryAddress: "九龍觀塘巧明街 6 號",
      shippingPartnerId: 45,
      orderingCustomerId: 42,
      orderingCustomerName: "Alice",
      orderingCustomerPhone: "91234567",
      orderingCustomerEmail: "alice@example.com",
      orderingCustomerBillingAddress: "1 Flower Market Road",
    }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(suggestions));
    vi.stubGlobal("fetch", fetchMock);
    const { searchOdooRecipients } = await import("@/lib/odoo-api");

    await expect(searchOdooRecipients("6")).resolves.toEqual(suggestions);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/recipients?q=6",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });

  it("loads a linked ordering customer profile by partner ID", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      id: 42,
      name: "Alice",
      email: "alice@example.com",
      phone: "91234567",
      mobile: null,
      history_count: null,
      total_spent: null,
      history: [],
      tags: [],
      customerType: "personal",
      companyName: null,
      billingAddress: "1 Flower Market Road",
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { getOdooCustomer } = await import("@/lib/odoo-api");

    await expect(getOdooCustomer(42)).resolves.toMatchObject({
      odooPartnerId: 42,
      name: "Alice",
      phone: "91234567",
      email: "alice@example.com",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/customers/42",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
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
      customerCode: " NEW-001 ",
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
      customerCode: " NEW-001 ",
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

  it("patches non-financial order details through the backend", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const response = { id: 17, writeDate: "2026-08-03 10:01:00" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);
    const { updateOdooOrderOperationalDetails } = await import("@/lib/odoo-api");
    const payload = {
      customerName: "Jay",
      senderName: "Jay",
      phone: "67610707",
      customerEmail: "",
      billingAddress: "",
      customerGroup: "",
      senderDoNumber: "",
      recipientDoNumber: "",
      sourceReference: "",
      department: "",
      terms: "",
      deliveryDate: "2026-08-04",
      deliveryTimeMode: "specified" as const,
      deliveryTime: "上午 10 時前",
      deliveryAddress: "觀塘新地址",
      recipientType: "personal" as const,
      recipientCompanyName: "",
      recipientName: "Ng",
      recipientPhone: "61234567",
      deliveryPerson: "",
      giftCardMessage: "",
      senderNote: "",
      deliveryNote: "",
      internalNote: "",
      expectedWriteDate: "2026-08-03 10:00:00",
    };

    await expect(updateOdooOrderOperationalDetails(17, payload)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/orders/17",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    );
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

  it("searches Odoo orders across dates with an encoded query", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const response = {
      generatedAt: "2026-08-01T22:00:00+08:00",
      truncated: false,
      orders: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);
    const { searchOdooOrderRecords } = await import("@/lib/odoo-api");

    await expect(searchOdooOrderRecords(" accounts+hk@example.com ")).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/orders?q=accounts%2Bhk%40example.com",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });

  it("does not call the backend for a one-character order query", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { searchOdooOrderRecords } = await import("@/lib/odoo-api");

    await expect(searchOdooOrderRecords("A")).resolves.toEqual({
      generatedAt: "",
      truncated: false,
      orders: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
