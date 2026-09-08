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

vi.mock("@/components/pos/CustomerSection", () => ({
  default: ({
    customerName,
    senderName,
    onNameChange,
    onSenderNameChange,
    onCustomerSelect,
  }: {
    customerName: string;
    senderName: string;
    onNameChange: (value: string) => void;
    onSenderNameChange: (value: string) => void;
    onCustomerSelect: (customer: {
      id: string;
      name: string;
      phone: string;
      history: [];
    }) => void;
  }) => (
    <section aria-label="customer-defaults-harness">
      <output data-testid="customer-name">{customerName}</output>
      <output data-testid="sender-name">{senderName}</output>
      <button
        type="button"
        onClick={() => onCustomerSelect({
          id: "odoo-11764",
          name: "JASON KWONG",
          phone: "90274536",
          history: [],
        })}
      >
        選擇測試聯絡人
      </button>
      <button type="button" onClick={() => onNameChange("JASON UPDATED")}>
        更新聯絡人名稱
      </button>
      <button type="button" onClick={() => onSenderNameChange("OTHER SENDER")}>
        自訂送花人
      </button>
    </section>
  ),
}));

describe("Index customer defaults", () => {
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
      generatedAt: new Date().toISOString(),
      truncated: false,
      orders: [],
    });
    odooMocks.getOdooProductCategories.mockResolvedValue([]);
    odooMocks.getOdooProducts.mockResolvedValue([]);
    odooMocks.getOperationalOrders.mockResolvedValue({
      date: "2026-09-08",
      timezone: "Asia/Hong_Kong",
      generatedAt: new Date().toISOString(),
      truncated: false,
      orders: [],
    });
    odooMocks.searchOdooOrderRecords.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      truncated: false,
      orders: [],
    });
  });

  it("defaults sender to the selected contact and preserves a later manual override", async () => {
    render(<MemoryRouter><Index /></MemoryRouter>);
    await waitFor(() => expect(odooMocks.getOperationalOrders).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "選擇測試聯絡人" }));
    expect(screen.getByTestId("customer-name")).toHaveTextContent("JASON KWONG");
    expect(screen.getByTestId("sender-name")).toHaveTextContent("JASON KWONG");

    fireEvent.click(screen.getByRole("button", { name: "更新聯絡人名稱" }));
    expect(screen.getByTestId("sender-name")).toHaveTextContent("JASON UPDATED");

    fireEvent.click(screen.getByRole("button", { name: "自訂送花人" }));
    fireEvent.click(screen.getByRole("button", { name: "更新聯絡人名稱" }));
    expect(screen.getByTestId("sender-name")).toHaveTextContent("OTHER SENDER");
  });
});
