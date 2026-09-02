import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Index from "@/pages/Index";

const odooMocks = vi.hoisted(() => ({
  getAccountingPaymentOptions: vi.fn(),
  getDeliverySlots: vi.fn(),
  getOdooEmployees: vi.fn(),
  getOdooSalesTeams: vi.fn(),
  getOdooCustomerGroups: vi.fn(),
  getOdooOrderRecords: vi.fn(),
  getOdooProductCategories: vi.fn(),
  getOdooProducts: vi.fn(),
  getOperationalOrders: vi.fn(),
  retryOperationalOrder: vi.fn(),
  searchOdooOrderRecords: vi.fn(),
}));

vi.mock("@/lib/odoo-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/odoo-api")>();
  return {
    ...original,
    hasOdooBackend: true,
    allowLocalOnlyOrders: false,
    ...odooMocks,
  };
});

vi.mock("@/components/auth/PosAuthContext", () => ({
  usePosAuth: () => ({
    employee: {
      id: 95,
      name: "Manager",
      login: "manager",
      salesLabel: "M001 — Manager",
      role: "manager",
    },
    logout: vi.fn(),
  }),
}));

const crossTabletRow = () => {
  const now = new Date().toISOString();
  return {
    operationalOrderId: "8c768e88-7de0-46e2-bc25-aea63e68df91",
    operatorEmployeeId: 22,
    order: {
      id: "8c768e88-7de0-46e2-bc25-aea63e68df91",
      salesId: "S022 — Tablet B",
      operatorEmployeeId: 22,
      customerName: "Cross-tablet customer",
      phone: "91234567",
      items: [{ id: "line-1", name: "Bouquet", price: 680, quantity: 1 }],
      deliveryFee: 0,
      urgentFee: 0,
      subtotal: 680,
      finalPrice: 680,
      priceOverridden: false,
      paymentStatus: "unpaid" as const,
      depositAmount: 0,
      paymentMethod: "",
      deliveryDate: "2026-08-28",
      deliveryTimeMode: "specified" as const,
      deliveryTime: "下午 3 時前",
      deliveryAddress: "Central",
      recipientName: "Recipient",
      recipientPhone: "61234567",
      deliveryPerson: "",
      giftCardEnabled: false,
      giftCardMessage: "",
      senderNote: "",
      deliveryNote: "",
      internalNote: "",
      createdAt: now,
    },
    syncState: "pending_odoo" as const,
    reviewError: null,
    lastError: "odoo_unavailable",
    attemptCount: 1,
    updatedAt: now,
    retryEligible: true,
    odooOrderId: null,
    odooOrderName: null,
    odooPartnerId: null,
  };
};

describe("Index operational-order hydration", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    odooMocks.getAccountingPaymentOptions.mockResolvedValue([]);
    odooMocks.getDeliverySlots.mockResolvedValue([]);
    odooMocks.getOdooEmployees.mockResolvedValue([]);
    odooMocks.getOdooSalesTeams.mockResolvedValue([]);
    odooMocks.getOdooCustomerGroups.mockResolvedValue([]);
    odooMocks.getOdooOrderRecords.mockResolvedValue({
      date: "2026-08-27",
      generatedAt: new Date().toISOString(),
      truncated: false,
      orders: [],
    });
    odooMocks.getOdooProductCategories.mockResolvedValue([]);
    odooMocks.getOdooProducts.mockResolvedValue([]);
    odooMocks.getOperationalOrders.mockResolvedValue({
      date: "2026-08-27",
      timezone: "Asia/Hong_Kong",
      generatedAt: new Date().toISOString(),
      truncated: false,
      orders: [crossTabletRow()],
    });
    odooMocks.retryOperationalOrder.mockResolvedValue({});
    odooMocks.searchOdooOrderRecords.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      truncated: false,
      orders: [],
    });
  });

  it("polls the server collection before the Odoo history drawer opens", async () => {
    render(<MemoryRouter><Index /></MemoryRouter>);

    await waitFor(() => expect(odooMocks.getOperationalOrders).toHaveBeenCalledTimes(1));
    expect(odooMocks.getOdooOrderRecords).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "訂單記錄" }));

    expect((await screen.findAllByText("Cross-tablet customer"))[0]).toBeVisible();
    expect(screen.getByRole("button", { name: /重試訂單 .* Odoo 同步/ })).toBeVisible();
    expect(screen.queryByText(/已嘗試/)).not.toBeInTheDocument();
  });

  it("keeps the pending backlog when Odoo exposes only a matching draft", async () => {
    const pending = crossTabletRow();
    odooMocks.getOperationalOrders.mockResolvedValue({
      date: "2026-08-27",
      timezone: "Asia/Hong_Kong",
      generatedAt: new Date().toISOString(),
      truncated: false,
      orders: [pending],
    });
    odooMocks.getOdooOrderRecords.mockResolvedValue({
      date: "2026-08-27",
      generatedAt: new Date().toISOString(),
      truncated: false,
      orders: [{
        ...pending.order,
        odooOrderId: 91,
        odooOrderName: "S00091",
      }],
    });

    render(<MemoryRouter><Index /></MemoryRouter>);
    await waitFor(() => expect(odooMocks.getOperationalOrders).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "訂單記錄" }));

    expect((await screen.findAllByText("Cross-tablet customer"))[0]).toBeVisible();
    expect(screen.getByRole("button", { name: /重試訂單 .* Odoo 同步/ })).toBeVisible();
    expect(screen.queryByText(/已嘗試/)).not.toBeInTheDocument();
  });
});
