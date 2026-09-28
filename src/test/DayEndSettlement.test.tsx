import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DayEndSettlement, { OrderTable, PaymentTable } from "@/pages/DayEndSettlement";
import type { DayEndOrderRow, DayEndPaymentRow } from "@/lib/odoo-api";

const getDayEndSummary = vi.hoisted(() => vi.fn());
const getOdooSalesTeams = vi.hoisted(() => vi.fn());
const reportDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });

vi.mock("@/lib/odoo-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/odoo-api")>();
  return {
    ...original,
    hasOdooBackend: true,
    getDayEndSummary,
    getOdooSalesTeams,
  };
});

const order: DayEndOrderRow = {
  id: 1,
  orderName: "S17785",
  invoiceReference: "POS-001",
  posLocalId: "local-001",
  dateOrder: "2026-08-03 10:01",
  customerName: "Jay",
  salesperson: "Testing — T001",
  paymentStatus: "unpaid",
  paymentMethod: null,
  paymentBucket: "unmapped",
  saleTotal: 1111,
  receivedToday: 0,
  depositAmount: 0,
  balanceAmount: 1111,
  remarks: null,
  deliveryDate: "2026-08-04",
  recipientType: "personal",
  recipientCompanyName: null,
  recipientName: "Ng",
  recipientPhone: "67610707",
  deliveryAddress: "觀塘巧明街",
  teamKey: "24",
  teamName: "Central",
};

const laterPayment: DayEndPaymentRow = {
  id: 2,
  paymentName: "PBNK1/2026/00018",
  paymentKey: "payment-key-2",
  checkoutKey: "checkout-old",
  receivedAt: "2026-08-27 09:47",
  amount: 600,
  paymentMethod: "bank_in_fps",
  paymentBucket: "bank_in_fps",
  paymentReference: "UAT-LATE-PAYMENT",
  operatorName: "Testing",
  orderId: 100,
  orderName: "S17803",
  orderDate: "2026-08-26 09:39",
  invoiceReference: "POS-old-order",
  customerName: "Alex",
  teamKey: "25",
  teamName: "Kowloon",
};

describe("DayEndSettlement order table", () => {
  beforeEach(() => {
    getDayEndSummary.mockReset();
    getOdooSalesTeams.mockReset();
    getOdooSalesTeams.mockResolvedValue([{ id: 24, name: "Central" }, { id: 25, name: "Kowloon" }]);
  });

  it("shows the employee or sales identity for every order", () => {
    render(<OrderTable orders={[order]} />);

    expect(screen.getByRole("columnheader", { name: "落單員工／Sales" })).toBeVisible();
    expect(screen.getByText("Testing — T001")).toBeVisible();
  });

  it("shows each cross-day receipt with its original order and payment audit fields", () => {
    render(<PaymentTable payments={[laterPayment]} />);

    const table = screen.getByRole("table");
    expect(within(table).getByText("PBNK1/2026/00018")).toBeVisible();
    expect(within(table).getByText("POS-old-order")).toBeVisible();
    expect(within(table).getByText("S17803")).toBeVisible();
    expect(within(table).getByText("2026-08-26 09:39")).toBeVisible();
    expect(within(table).getByText("UAT-LATE-PAYMENT")).toBeVisible();
    expect(within(table).getByText("HK$600")).toBeVisible();
  });

  it("uses A plus B payment buckets and labels order value without claiming revenue", async () => {
    getDayEndSummary.mockResolvedValue({
      date: reportDate,
      timezone: "Asia/Hong_Kong",
      generatedAt: "2026-08-27T18:00:00+08:00",
      odooAvailable: true,
      selectedTeam: "all",
      teamSummaries: [
        { key: "24", label: "Central", orderCount: 1, saleTotal: 1111, receivedToday: 400, receivedForOtherDays: 0, totalMoneyReceived: 400 },
        { key: "25", label: "Kowloon", orderCount: 0, saleTotal: 0, receivedToday: 0, receivedForOtherDays: 600, totalMoneyReceived: 600 },
      ],
      salesToday: {
        label: "今日落單",
        orderCount: 1,
        saleTotal: 1111,
        receivedTotal: 400,
        averageSpend: 1111,
        buckets: [{ key: "card_terminal", label: "Card Terminal", amount: 400, orderCount: 1 }],
        orders: [{ ...order, receivedToday: 400, paymentStatus: "deposit", paymentMethod: "card_terminal" }],
        payments: [],
        unsupportedReason: null,
      },
      receivedForOtherDays: {
        label: "今日舊單或未匹配收款",
        orderCount: 1,
        saleTotal: 0,
        receivedTotal: 600,
        averageSpend: 0,
        buckets: [{ key: "bank_in_fps", label: "Bank-in / FPS", amount: 600, orderCount: 1 }],
        orders: [],
        payments: [laterPayment],
        unsupportedReason: null,
      },
      totalMoneyReceived: 1000,
      paymentBuckets: [
        { key: "bank_in_fps", label: "Bank-in / FPS", amount: 600, orderCount: 1 },
        { key: "card_terminal", label: "Card Terminal", amount: 400, orderCount: 1 },
      ],
      summaryHash: "hash",
    });

    render(<MemoryRouter><DayEndSettlement /></MemoryRouter>);

    expect(await screen.findByText("Order value today")).toBeVisible();
    expect(screen.queryByText("Sales today")).not.toBeInTheDocument();
    expect(screen.getByText("A. 今日落單金額 Orders Booked Today")).toBeVisible();
    expect(screen.getByText("B. 今日舊單／未匹配收款")).toBeVisible();
    expect(screen.getByText("已匹配訂單：")).toBeVisible();
    expect(screen.getByText("PBNK1/2026/00018")).toBeVisible();
    expect(screen.getByText("Bank-in / FPS")).toBeVisible();
    expect(screen.getAllByText("HK$600").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("HK$1,000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Sales Team 分佈")).toBeVisible();
    expect(screen.getByText(/· 全部 Sales Teams$/)).toBeVisible();
  });

  it("passes the selected team to Odoo and shows only that team's report", async () => {
    getDayEndSummary.mockImplementation(async (_date: string, _signal: AbortSignal, team: string) => ({
      date: reportDate,
      timezone: "Asia/Hong_Kong",
      generatedAt: "2026-08-27T18:00:00+08:00",
      odooAvailable: true,
      selectedTeam: team,
      teamSummaries: [
        { key: "24", label: "Central", orderCount: 1, saleTotal: 38, receivedToday: 2, receivedForOtherDays: 0, totalMoneyReceived: 2 },
        { key: "25", label: "Kowloon", orderCount: 1, saleTotal: 100, receivedToday: 100, receivedForOtherDays: 0, totalMoneyReceived: 100 },
      ],
      salesToday: {
        label: "今日落單", orderCount: team === "24" ? 1 : 2,
        saleTotal: team === "24" ? 38 : 138,
        receivedTotal: team === "24" ? 2 : 102,
        averageSpend: team === "24" ? 38 : 69,
        buckets: [], orders: [], payments: [], unsupportedReason: null,
      },
      receivedForOtherDays: {
        label: "今日舊單或未匹配收款", orderCount: 0, saleTotal: 0,
        receivedTotal: 0, averageSpend: 0, buckets: [], orders: [], payments: [], unsupportedReason: null,
      },
      totalMoneyReceived: team === "24" ? 2 : 102,
      paymentBuckets: [],
      summaryHash: `hash-${team}`,
    }));

    render(<MemoryRouter><DayEndSettlement /></MemoryRouter>);
    await screen.findByText("Sales Team 分佈");
    fireEvent.change(screen.getByPlaceholderText("負責輸入同事名"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByPlaceholderText("負責覆核同事名"), { target: { value: "Bob" } });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Sales Team" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Central" }));

    await waitFor(() => expect(getDayEndSummary).toHaveBeenLastCalledWith(expect.any(String), expect.anything(), "24"));
    expect(await screen.findByText(/· Central$/)).toBeVisible();
    expect(screen.getAllByText("HK$38").length).toBeGreaterThan(0);
    expect(screen.queryByText("HK$138")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("負責輸入同事名")).toHaveValue("Alice");
    expect(screen.getByPlaceholderText("負責覆核同事名")).toHaveValue("Bob");

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Sales Team" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "未匹配訂單收款" }));
    await waitFor(() => expect(getDayEndSummary).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.anything(),
      "unmatched",
    ));
    expect(await screen.findByText(/· 未匹配訂單收款$/)).toBeVisible();
  });

  it("hides every official metric and table when Odoo is unavailable", async () => {
    getDayEndSummary.mockResolvedValue({
      date: reportDate,
      timezone: "Asia/Hong_Kong",
      generatedAt: "2026-08-27T18:00:00+08:00",
      odooAvailable: false,
      selectedTeam: "all",
      availabilityMessage: "Odoo 暫時未能連線，請稍後重試。",
      salesToday: null,
      receivedForOtherDays: null,
      totalMoneyReceived: null,
      paymentBuckets: null,
      summaryHash: null,
    });

    render(<MemoryRouter><DayEndSettlement /></MemoryRouter>);

    expect(await screen.findByText("Odoo 暫時無法使用")).toBeVisible();
    expect(screen.getByText("Odoo 暫時未能連線，請稍後重試。")).toBeVisible();
    expect(screen.getByRole("button", { name: "重試讀取 Odoo 日結" })).toHaveClass(
      "min-h-11",
      "touch-manipulation",
    );
    expect(screen.getByRole("button", { name: "列印埋數表" })).toBeDisabled();
    expect(screen.queryByText("Order qty")).not.toBeInTheDocument();
    expect(screen.queryByText("Order value today")).not.toBeInTheDocument();
    expect(screen.queryByText("付款方式總覽")).not.toBeInTheDocument();
    expect(screen.queryByText("A. 今日落單金額 Orders Booked Today")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("does not show unfiltered totals as a team's totals when the API is outdated", async () => {
    getDayEndSummary.mockResolvedValue({
      date: reportDate,
      timezone: "Asia/Hong_Kong",
      generatedAt: "2026-08-27T18:00:00+08:00",
      odooAvailable: true,
      salesToday: { orderCount: 1, saleTotal: 9999 },
      totalMoneyReceived: 9999,
    });

    render(<MemoryRouter><DayEndSettlement /></MemoryRouter>);

    expect(await screen.findByText("日結後端尚未支援 Sales Team 篩選，請更新後再試。")).toBeVisible();
    expect(screen.queryByText("HK$9,999")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "列印埋數表" })).toBeDisabled();
  });
});
