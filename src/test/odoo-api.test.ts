import { afterEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@/types/order";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("odoo-api note contracts", () => {
  it("keeps FastAPI validation field names and reasons in submission errors", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      detail: [{
        loc: ["body", "deliveryDistrict"],
        msg: "Field required",
        type: "missing",
      }],
    }, 422)));
    const { OdooApiError, submitOdooOrder } = await import("@/lib/odoo-api");

    await expect(submitOdooOrder({ id: "missing-district" } as Order)).rejects.toMatchObject({
      name: "OdooApiError",
      status: 422,
      message: "deliveryDistrict: Field required",
    } satisfies Partial<InstanceType<typeof OdooApiError>>);
  });

  it("treats HTTP 202 as a durably saved order waiting for Odoo", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const pendingResponse = {
      operationalOrderId: "43e81d2e-ccfb-415b-8799-12a2e7a528d4",
      syncState: "pending_odoo",
      reviewError: null,
      id: null,
      name: null,
      clientOrderRef: "POS-43e81d2e-ccfb-415b-8799-12a2e7a528d4",
      amountTotal: 680,
      partnerId: null,
      accounting: null,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(pendingResponse, 202)));
    const { submitOdooOrder } = await import("@/lib/odoo-api");

    await expect(submitOdooOrder({
      id: pendingResponse.operationalOrderId,
      notes: "legacy note is removed",
    } as Order)).resolves.toEqual(pendingResponse);
  });

  it("returns a durable review record from HTTP 409 instead of losing its identity", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const reviewResponse = {
      operationalOrderId: "a88ab0bc-d334-4482-8a1a-8a754132310f",
      syncState: "needs_review",
      reviewError: "customer_conflict",
      id: null,
      name: null,
      clientOrderRef: null,
      amountTotal: 123,
      partnerId: null,
      accounting: null,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(reviewResponse, 409)));
    const { submitOdooOrder } = await import("@/lib/odoo-api");

    await expect(submitOdooOrder({ id: reviewResponse.operationalOrderId } as Order))
      .resolves.toEqual(reviewResponse);
  });

  it("loads the authenticated operational status by encoded checkout ID", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const status = {
      operationalOrderId: "order / 42",
      syncState: "syncing",
      odooOrderId: null,
      odooOrderName: null,
      odooPartnerId: null,
      reviewError: null,
      lastError: null,
      attemptCount: 1,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status));
    vi.stubGlobal("fetch", fetchMock);
    const { getOperationalOrderStatus } = await import("@/lib/odoo-api");

    await expect(getOperationalOrderStatus(status.operationalOrderId)).resolves.toEqual(status);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/orders/operational/order%20%2F%2042",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });

  it("loads the authenticated current-day operational collection contract", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const rows = [{
      operationalOrderId: "43e81d2e-ccfb-415b-8799-12a2e7a528d4",
      operatorEmployeeId: 95,
      order: { id: "43e81d2e-ccfb-415b-8799-12a2e7a528d4" },
      syncState: "pending_odoo",
      reviewError: null,
      lastError: "odoo_unavailable",
      attemptCount: 2,
      updatedAt: "2026-08-27T10:00:00+08:00",
      retryEligible: true,
      odooOrderId: null,
      odooOrderName: null,
      odooPartnerId: null,
    }];
    const collection = {
      date: "2026-08-27",
      timezone: "Asia/Hong_Kong",
      generatedAt: "2026-08-27T10:00:00+08:00",
      truncated: true,
      orders: rows,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(collection));
    vi.stubGlobal("fetch", fetchMock);
    const { getOperationalOrders } = await import("@/lib/odoo-api");

    await expect(getOperationalOrders()).resolves.toEqual(collection);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/orders/operational",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });

  it("loads the manager sync error center without browser-controlled filters", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const diagnostics = {
      generatedAt: "2026-09-01T15:00:00+08:00",
      summary: {
        pendingCount: 0,
        syncingCount: 0,
        needsReviewCount: 0,
        unresolvedCount: 0,
        unresolvedValueMinor: 0,
        oldestAcceptedAt: null,
      },
      worker: {
        status: "unknown",
        lastStartedAt: null,
        lastCompletedAt: null,
        lastSuccessAt: null,
        lastClaimed: 0,
        lastSynced: 0,
        lastRetried: 0,
        lastNeedsReview: 0,
      },
      truncated: false,
      orders: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(diagnostics));
    vi.stubGlobal("fetch", fetchMock);
    const { getSyncErrorCenter } = await import("@/lib/odoo-api");

    await expect(getSyncErrorCenter()).resolves.toEqual(diagnostics);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/orders/operational/errors",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });

  it("posts a manager retry to the encoded operational-order route", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const response = {
      operationalOrderId: "order / 42",
      syncState: "syncing",
      odooOrderId: null,
      odooOrderName: null,
      odooPartnerId: null,
      reviewError: null,
      lastError: null,
      attemptCount: 3,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);
    const { retryOperationalOrder } = await import("@/lib/odoo-api");

    await expect(retryOperationalOrder("order / 42")).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/orders/operational/order%20%2F%2042/retry",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("posts a manager recovery to the encoded review-order route", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const response = {
      operationalOrderId: "order / 42",
      syncState: "synced",
      odooOrderId: 42,
      odooOrderName: "S00042",
      odooPartnerId: 8,
      reviewError: null,
      lastError: null,
      attemptCount: 4,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);
    const { recoverOperationalOrder } = await import("@/lib/odoo-api");

    await expect(recoverOperationalOrder("order / 42")).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/orders/operational/order%20%2F%2042/recover",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("preserves the typed day-end outage response and availabilityMessage", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const outage = {
      date: "2026-08-27",
      timezone: "Asia/Hong_Kong",
      generatedAt: "2026-08-27T18:00:00+08:00",
      odooAvailable: false,
      availabilityMessage: "Odoo is temporarily unavailable. Retry after service recovers.",
      salesToday: null,
      receivedForOtherDays: null,
      totalMoneyReceived: null,
      summaryHash: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(outage, 503));
    vi.stubGlobal("fetch", fetchMock);
    const { getDayEndSummary } = await import("@/lib/odoo-api");

    await expect(getDayEndSummary("2026-08-27")).resolves.toEqual(outage);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/day-end/summary?date=2026-08-27",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });

  it("loads the exact paginated receivables contract with the signed POS session", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    window.sessionStorage.setItem("anglo-chinese-florist-pos-session", "signed-manager-session");
    const receivables = {
      snapshotVersion: "receivables-snapshot-1",
      generatedAt: "2026-08-30T10:30:00+08:00",
      asOfDate: "2026-08-30",
      timezone: "Asia/Hong_Kong",
      summary: {
        companyCurrencyId: 344,
        companyCurrency: "HKD",
        openInvoiceCount: 1,
        openResidual: 600,
        overdueInvoiceCount: 1,
        overdueResidual: 600,
        dueTodayInvoiceCount: 0,
        dueTodayResidual: 0,
        notDueInvoiceCount: 0,
        notDueResidual: 0,
        missingDueDateInvoiceCount: 0,
        missingDueDateResidual: 0,
      },
      rows: [{
        id: 42,
        invoiceNumber: "INV/2026/0042",
        reference: "PO-42",
        origin: "S00042",
        invoiceDate: "2026-07-01",
        dueDate: "2026-08-01",
        paymentTermId: 3,
        paymentTerm: "30 Days",
        customerId: 7,
        customerName: "Alpha",
        salespersonId: 8,
        salesperson: "Elma",
        currencyId: 344,
        currency: "HKD",
        amountTotal: 1_000,
        amountReconciled: 400,
        amountResidual: 600,
        companyCurrencyResidual: 600,
        reconciliationStatus: "partially_reconciled",
        status: "overdue",
        daysOverdue: 29,
        daysUntilDue: null,
        overdueResidual: 600,
        dueTodayResidual: 0,
        notDueResidual: 0,
        missingDueDateResidual: 0,
      }],
      totalRows: 1,
      page: 2,
      limit: 25,
      hasMore: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(receivables));
    vi.stubGlobal("fetch", fetchMock);
    const { getReceivables } = await import("@/lib/odoo-api");

    await expect(getReceivables({ status: "overdue", page: 2, limit: 25 }))
      .resolves.toEqual(receivables);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/accounting/receivables?status=overdue&page=2&limit=25&refresh=false",
      expect.objectContaining({ cache: "no-store" }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(requestInit.headers).get("Authorization")).toBe(
      "Bearer signed-manager-session",
    );
    window.sessionStorage.removeItem("anglo-chinese-florist-pos-session");
  });

  it("sends a receivables snapshot only for non-refresh requests", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({
      snapshotVersion: "receivables-snapshot-1",
    })));
    vi.stubGlobal("fetch", fetchMock);
    const { getReceivables } = await import("@/lib/odoo-api");

    await getReceivables({
      status: "due_today",
      page: 3,
      limit: 100,
      snapshotVersion: "snapshot / one",
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://backend.test/accounting/receivables?status=due_today&page=3&limit=100&refresh=false&snapshot=snapshot+%2F+one",
      expect.objectContaining({ cache: "no-store" }),
    );

    await getReceivables({
      refresh: true,
      snapshotVersion: "snapshot-must-be-ignored",
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://backend.test/accounting/receivables?status=all&page=1&limit=50&refresh=true",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("validates current manager access through the authenticated no-store endpoint", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    window.sessionStorage.setItem("anglo-chinese-florist-pos-session", "signed-manager-session");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { validateReceivablesAccess } = await import("@/lib/odoo-api");

    await expect(validateReceivablesAccess()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/accounting/receivables/access",
      expect.objectContaining({ cache: "no-store" }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(requestInit.headers).get("Authorization")).toBe(
      "Bearer signed-manager-session",
    );
    window.sessionStorage.removeItem("anglo-chinese-florist-pos-session");
  });

  it("loads one receivable contact only from the manager detail endpoint", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    window.sessionStorage.setItem("anglo-chinese-florist-pos-session", "signed-manager-session");
    const detail = {
      invoiceId: 42,
      customerId: 7,
      customerName: "Alpha",
      customerCompany: "Alpha Limited",
      customerPhone: "91234567",
      customerEmail: "accounts@alpha.example",
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(detail));
    vi.stubGlobal("fetch", fetchMock);
    const { getReceivableDetail } = await import("@/lib/odoo-api");

    await expect(getReceivableDetail(42)).resolves.toEqual(detail);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/accounting/receivables/42/detail",
      expect.objectContaining({ cache: "no-store" }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(requestInit.headers).get("Authorization")).toBe(
      "Bearer signed-manager-session",
    );
    window.sessionStorage.removeItem("anglo-chinese-florist-pos-session");
  });

  it("stops a stalled product reorder instead of leaving the UI saving forever", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })
    )));
    const { reorderOdooProducts } = await import("@/lib/odoo-api");

    const request = reorderOdooProducts([{ id: 9, displaySequence: 10 }]);
    const assertion = expect(request).rejects.toThrow(
      "儲存排序逾時，請稍後再試。系統未有確認排序變更。",
    );
    await vi.advanceTimersByTimeAsync(30_000);

    await assertion;
    vi.useRealTimers();
  });

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

  it("loads native Sales Teams and current Odoo Contact Tags", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 7, name: "Retail" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 12, name: "Corporate" }]));
    vi.stubGlobal("fetch", fetchMock);
    const { getOdooCustomerGroups, getOdooSalesTeams } = await import("@/lib/odoo-api");

    await expect(getOdooSalesTeams()).resolves.toEqual([{ id: 7, name: "Retail" }]);
    await expect(getOdooCustomerGroups()).resolves.toEqual([{ id: 12, name: "Corporate" }]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://backend.test/sales-teams",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://backend.test/customer-groups",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
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
      tags: [{ id: 12, name: "Corporate", color: 3 }],
      customerGroupId: 12,
      customerGroup: "Corporate",
      writeDate: "2026-08-29 09:15:00",
      customerType: "company",
      companyName: "Alice Limited",
      billingAddress: "1 Flower Market Road",
      recipientBirthday: "1970-01-01",
      recipientMatch: {
        name: "Mary Wong",
        phone: "6111 1111",
        resolved: true,
        recipientType: "company",
        companyName: "Mary Flowers Limited",
        recipientBirthday: "1990-01-02",
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
      customerGroupId: 12,
      customerGroup: "Corporate",
      writeDate: "2026-08-29 09:15:00",
      recipientMatch: {
        name: "Mary Wong",
        phone: "6111 1111",
        resolved: true,
        recipientType: "company",
        companyName: "Mary Flowers Limited",
        recipientBirthday: "1990-01-02",
        deliveryAddress: "6 How Ming Street",
        shippingPartnerId: 45,
      },
      history: [],
    });
    expect(customer.historyCount).toBeUndefined();
    expect(customer.totalSpent).toBeUndefined();
    expect(customer).not.toHaveProperty("recipientBirthday");
  });

  it("preserves birthday ownership and falls back when API occasions are null", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const partner = (id: number, recipientMatch: Record<string, unknown>) => ({
      id,
      name: `Customer ${id}`,
      email: null,
      phone: "91234567",
      mobile: null,
      history_count: null,
      total_spent: null,
      history: [],
      recipientMatch: {
        name: `Recipient ${id}`,
        phone: "61234567",
        resolved: true,
        recipientType: "personal",
        companyName: null,
        deliveryAddress: "6 How Ming Street",
        shippingPartnerId: id + 40,
        ...recipientMatch,
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([
      partner(42, {}),
      partner(43, { recipientBirthday: null }),
      partner(44, { recipientBirthday: "" }),
      partner(45, {
        recipientOccasions: [{ type: "anniversary", date: "2020-06-18" }],
        recipientOccasionsVersion: "recipient-85-v4",
        recipientBirthday: "1990-01-02",
      }),
      partner(46, {
        recipientOccasions: null,
        recipientBirthday: "1988-04-05",
      }),
    ])));
    const { searchOdooCustomers } = await import("@/lib/odoo-api");

    const customers = await searchOdooCustomers("Customer");

    expect(customers[0].recipientMatch).not.toHaveProperty("recipientBirthday");
    expect(customers[1].recipientMatch).toHaveProperty("recipientBirthday", null);
    expect(customers[2].recipientMatch).toHaveProperty("recipientBirthday", "");
    expect(customers[3].recipientMatch).toHaveProperty("recipientOccasions", [
      { type: "anniversary", date: "2020-06-18" },
    ]);
    expect(customers[3].recipientMatch).toHaveProperty(
      "recipientOccasionsVersion",
      "recipient-85-v4",
    );
    expect(customers[3].recipientMatch).not.toHaveProperty("recipientBirthday");
    expect(customers[4].recipientMatch).not.toHaveProperty("recipientOccasions");
    expect(customers[4].recipientMatch).not.toHaveProperty("recipientOccasionsVersion");
    expect(customers[4].recipientMatch).toHaveProperty("recipientBirthday", "1988-04-05");
  });

  it("keeps multiple existing Contact Tags as a snapshot without inventing a Customer Group ID", async () => {
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
      tags: [
        { id: 12, name: "Corporate" },
        { id: 13, name: "VIP Wholesale" },
      ],
      customerGroupId: null,
      customerGroup: null,
    }])));
    const { searchOdooCustomers } = await import("@/lib/odoo-api");

    const [customer] = await searchOdooCustomers("Alice");

    expect(customer.customerGroup).toBe("Corporate, VIP Wholesale");
    expect(customer.customerGroupId).toBeUndefined();
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

  it("requests Customer ID prefix matches explicitly", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{
      id: 42,
      name: "Crowne Plaza Contact",
      email: null,
      phone: "91234567",
      mobile: null,
      customerCode: "CROWNEP",
      history_count: null,
      total_spent: null,
      history: [],
      tags: [],
    }]));
    vi.stubGlobal("fetch", fetchMock);
    const { searchOdooCustomers } = await import("@/lib/odoo-api");

    const [customer] = await searchOdooCustomers(
      " Cr ",
      undefined,
      "customer_code",
      "prefix",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/customers?q=Cr&searchType=customer_code&matchMode=prefix",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
    expect(customer.customerCode).toBe("CROWNEP");
  });

  it("does not request Customer ID prefix matches before two characters", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { searchOdooCustomers } = await import("@/lib/odoo-api");

    const customers = await searchOdooCustomers(
      "C",
      undefined,
      "customer_code",
      "prefix",
    );

    expect(customers).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads a shared Customer ID as an account with selectable contacts", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      customerCode: "WONDER",
      contactCount: 1435,
      truncated: true,
      contacts: [{
        id: 42,
        name: "Alice",
        email: "alice@example.com",
        phone: "91234567",
        mobile: null,
        customerCode: "WONDER",
        history_count: null,
        total_spent: null,
        history: [],
        tags: [],
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { searchOdooCustomerAccount } = await import("@/lib/odoo-api");

    const account = await searchOdooCustomerAccount(" wonder ");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/customer-accounts?code=wonder",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
    expect(account).toMatchObject({
      customerCode: "WONDER",
      contactCount: 1435,
      truncated: true,
      contacts: [{ odooPartnerId: 42, customerCode: "WONDER" }],
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
      recipientBirthday: "1990-01-02",
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
      salespersonEmployeeId: 96,
      salesTeamId: 7,
      customerGroupId: 12,
      customerGroupExpectedWriteDate: "2026-07-14 10:00:00",
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
      recipientBirthday: "1990-01-02",
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
      salespersonEmployeeId: 96,
      salesTeamId: 7,
      customerGroupId: 12,
      customerGroupExpectedWriteDate: "2026-07-14 10:00:00",
      paymentReference: "CASH-001",
      paymentReceivedAt: "2026-07-14T10:00:00.000Z",
      paymentIdempotencyKey: "744078bd-ae57-4639-af5a-11d8805654b1",
      deliveryTimeMode: "slot",
      deliverySlotId: 11,
      recipientType: "company",
      recipientCompanyName: "Recipient Limited",
      recipientBirthday: "1990-01-02",
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

  it("submits new free-text teams and recipient occasions without legacy IDs or birthday", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      id: 8,
      name: "S00008",
      clientOrderRef: "POS-local-2",
      amountTotal: 500,
      partnerId: 42,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { submitOdooOrder } = await import("@/lib/odoo-api");

    await submitOdooOrder({
      id: "local-2",
      department: "Corporate Events",
      recipientOccasions: [
        { type: "birthday", date: "1990-01-02" },
        { type: "other", label: "相識紀念日", date: "2020-09-01" },
      ],
      recipientOccasionsVersion: "recipient-84-v3",
    } as Order);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      department: "Corporate Events",
      recipientOccasions: [
        { type: "birthday", date: "1990-01-02" },
        { type: "other", label: "相識紀念日", date: "2020-09-01" },
      ],
      recipientOccasionsVersion: "recipient-84-v3",
    });
    expect(payload).not.toHaveProperty("salesTeamId");
    expect(payload).not.toHaveProperty("recipientBirthday");
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
      salesId: "AC02 — Elma",
      salespersonEmployeeId: 95,
      salesTeamId: 7,
      customerGroupId: 12,
      fulfillmentType: "delivery" as const,
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
      deliveryGoogleAddress: "觀塘新地址",
      deliveryBuilding: "",
      deliveryFloor: "",
      deliveryUnit: "",
      deliverySplits: [{
        id: "split-2",
        fulfillmentType: "pickup" as const,
        deliveryDate: "2026-08-05",
        deliveryTimeMode: "specified" as const,
        deliveryTime: "15:00",
        deliveryRegion: "",
        deliveryDistrict: "",
        deliveryArea: "",
        deliveryDetail: "",
        deliveryAddress: "香港中環擺花街24號地下",
        deliveryGoogleAddress: "",
        deliveryBuilding: "",
        deliveryFloor: "",
        deliveryUnit: "",
        recipientType: "personal" as const,
        recipientCompanyName: "",
        recipientName: "Pickup Contact",
        recipientPhone: "63334444",
        recipientBirthday: "1985-11-12",
        deliveryPerson: "",
        failedDeliveryAction: "none",
        deliveryNote: "",
        itemAllocations: [{ itemId: "odoo-line-1", itemName: "Bouquet", quantity: 1 }],
      }],
      recipientType: "personal" as const,
      recipientCompanyName: "",
      recipientName: "Ng",
      recipientPhone: "61234567",
      recipientBirthday: "1990-01-02",
      deliveryPerson: "",
      giftCardMessage: "",
      senderNote: "",
      deliveryNote: "",
      internalNote: "",
      expectedWriteDate: "2026-08-03 10:00:00",
    };

    await expect(updateOdooOrderOperationalDetails(17, payload)).resolves.toEqual(response);
    const {
      salesId: _salesId,
      department: _department,
      customerGroup: _customerGroup,
      salespersonEmployeeId: _salespersonEmployeeId,
      salesTeamId: _salesTeamId,
      customerGroupId: _customerGroupId,
      ...expectedPayload
    } = payload;
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/orders/17",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(expectedPayload),
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

  it("searches Odoo orders with an encoded query and optional order date", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const response = {
      generatedAt: "2026-08-01T22:00:00+08:00",
      truncated: false,
      orders: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);
    const { searchOdooOrderRecords } = await import("@/lib/odoo-api");

    await expect(searchOdooOrderRecords(
      " accounts+hk@example.com ",
      undefined,
      "2026-07-19",
    )).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/orders?q=accounts%2Bhk%40example.com&date=2026-07-19",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });

  it("preserves query-only Odoo order search callers", async () => {
    vi.stubEnv("VITE_BACKEND_URL", "https://backend.test");
    const response = {
      generatedAt: "2026-08-01T22:00:00+08:00",
      truncated: false,
      orders: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);
    const { searchOdooOrderRecords } = await import("@/lib/odoo-api");

    await expect(searchOdooOrderRecords("Wong")).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/orders?q=Wong",
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
