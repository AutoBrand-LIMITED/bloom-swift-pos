import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Index from "@/pages/Index";
import type { OdooOrderRecordsResponse } from "@/lib/odoo-api";
import { hongKongBusinessDate, UNSYNCED_ORDERS_KEY } from "@/lib/order-records";
import type { Order } from "@/types/order";

const odooMocks = vi.hoisted(() => ({
  getAccountingPaymentOptions: vi.fn(),
  getDeliverySlots: vi.fn(),
  getOdooEmployees: vi.fn(),
  getOdooSalesTeams: vi.fn(),
  getOdooCustomerGroups: vi.fn(),
  getOdooOrderRecords: vi.fn(),
  getOdooProductCategories: vi.fn(),
  getOdooProducts: vi.fn(),
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

const orderFixture = (
  id: number,
  customerName: string,
  overrides: Partial<Order> = {},
): Order => ({
  id: `local-${id}`,
  odooOrderId: id,
  odooOrderName: `S${String(id).padStart(5, "0")}`,
  writeDate: "2026-08-26 09:00:00",
  salesId: "S001",
  customerName,
  senderName: customerName,
  phone: "91234567",
  items: [{ id: `line-${id}`, name: "Bouquet", price: 680, quantity: 1 }],
  deliveryFee: 0,
  urgentFee: 0,
  subtotal: 680,
  finalPrice: 680,
  priceOverridden: false,
  paymentStatus: "paid",
  depositAmount: 0,
  paymentMethod: "cash_other",
  fulfillmentType: "delivery",
  deliveryDate: "2026-08-27",
  deliveryTimeMode: "specified",
  deliveryTime: "下午 3 時前",
  deliveryAddress: "Central",
  recipientType: "personal",
  recipientName: "Recipient",
  recipientPhone: "61234567",
  deliveryPerson: "",
  giftCardEnabled: false,
  giftCardMessage: "",
  senderNote: "",
  deliveryNote: "",
  internalNote: "",
  createdAt: "2026-08-26T09:00:00+08:00",
  ...overrides,
});

function deferredResponse() {
  let resolve!: (value: OdooOrderRecordsResponse) => void;
  const promise = new Promise<OdooOrderRecordsResponse>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("Index correlated order search", () => {
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
      date: "2026-08-26",
      generatedAt: "2026-08-26T09:00:00+08:00",
      truncated: false,
      orders: [],
    });
    odooMocks.getOdooProductCategories.mockResolvedValue([]);
    odooMocks.getOdooProducts.mockResolvedValue([]);
  });

  it("loads recent orders by default and applies an optional date filter", async () => {
    render(<MemoryRouter><Index /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /訂單記錄/ }));

    const dateInput = screen.getByLabelText("落單日期（選填）");
    expect(dateInput).toHaveValue("");
    await waitFor(() => expect(odooMocks.getOdooOrderRecords).toHaveBeenCalledWith(
      undefined,
      expect.any(AbortSignal),
    ));
    expect(screen.getByText(/顯示最新訂單，按落單時間由新至舊排列/)).toBeVisible();

    fireEvent.change(dateInput, { target: { value: "2026-08-25" } });
    await waitFor(() => expect(odooMocks.getOdooOrderRecords).toHaveBeenCalledWith(
      "2026-08-25",
      expect.any(AbortSignal),
    ));
    expect(screen.getByText(/顯示 2026-08-25 的落單記錄/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "清除落單日期篩選" }));
    await waitFor(() => expect(odooMocks.getOdooOrderRecords).toHaveBeenLastCalledWith(
      undefined,
      expect.any(AbortSignal),
    ));
  });

  it("correlates combined search by query and date and ignores the stale date response", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    odooMocks.searchOdooOrderRecords.mockImplementation((
      _query: string,
      _signal: AbortSignal,
      date?: string,
    ) => (
      date === undefined ? first.promise : second.promise
    ));

    render(<MemoryRouter><Index /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /訂單記錄/ }));
    await waitFor(() => expect(odooMocks.getOdooOrderRecords).toHaveBeenCalledTimes(1));

    const search = screen.getByRole("textbox", { name: "搜尋訂單" });
    fireEvent.change(search, { target: { value: "Alpha" } });
    expect(screen.getAllByText("等待跨日期搜尋訂單...").length).toBeGreaterThan(0);
    expect(screen.queryByText("未找到符合資料的訂單")).not.toBeInTheDocument();

    await waitFor(
      () => expect(odooMocks.searchOdooOrderRecords).toHaveBeenCalledWith(
        "Alpha",
        expect.any(AbortSignal),
        undefined,
      ),
      { timeout: 1_000 },
    );
    expect(screen.getAllByText("正在跨日期搜尋訂單...").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("落單日期（選填）"), {
      target: { value: "2026-08-25" },
    });
    expect(screen.queryByText("未找到符合資料的訂單")).not.toBeInTheDocument();
    await waitFor(
      () => expect(odooMocks.searchOdooOrderRecords).toHaveBeenCalledWith(
        "Alpha",
        expect.any(AbortSignal),
        "2026-08-25",
      ),
      { timeout: 1_000 },
    );

    await act(async () => {
      second.resolve({
        generatedAt: "2026-08-26T09:01:00+08:00",
        truncated: false,
        orders: [orderFixture(22, "New Match")],
      });
    });
    expect((await screen.findAllByText("New Match"))[0]).toBeVisible();
    expect(screen.getByText("2026-08-25 搜尋結果：1 筆")).toBeVisible();

    await act(async () => {
      first.resolve({
        generatedAt: "2026-08-26T09:02:00+08:00",
        truncated: false,
        orders: [orderFixture(21, "Old Match")],
      });
      await Promise.resolve();
    });
    expect(screen.getAllByText("New Match")[0]).toBeVisible();
    expect(screen.queryByText("Old Match")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清除訂單搜尋" }));
    expect(screen.getByLabelText("落單日期（選填）")).toHaveValue("2026-08-25");
    await waitFor(() => expect(odooMocks.getOdooOrderRecords).toHaveBeenCalledWith(
      "2026-08-25",
      expect.any(AbortSignal),
    ));
  });

  it("shows recent local fallback rows across dates until a date filter is applied", async () => {
    const now = new Date();
    const previous = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    const previousDate = hongKongBusinessDate(previous);
    localStorage.setItem(UNSYNCED_ORDERS_KEY, JSON.stringify([
      orderFixture(31, "Local Today", { createdAt: now.toISOString() }),
      orderFixture(32, "Local Previous", { createdAt: previous.toISOString() }),
      orderFixture(33, "Malformed Local", { createdAt: "not-a-date" }),
    ]));

    render(<MemoryRouter><Index /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /訂單記錄/ }));
    await waitFor(() => expect(odooMocks.getOdooOrderRecords).toHaveBeenCalledWith(
      undefined,
      expect.any(AbortSignal),
    ));

    expect(screen.getAllByText("Local Today")[0]).toBeVisible();
    expect(screen.getAllByText("Local Previous")[0]).toBeVisible();
    expect(screen.queryByText("Malformed Local")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("落單日期（選填）"), {
      target: { value: previousDate },
    });
    expect((await screen.findAllByText("Local Previous"))[0]).toBeVisible();
    expect(screen.queryByText("Local Today")).not.toBeInTheDocument();
    expect(screen.queryByText("Malformed Local")).not.toBeInTheDocument();
  });
});
