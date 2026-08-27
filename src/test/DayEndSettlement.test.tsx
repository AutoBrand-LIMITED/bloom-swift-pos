import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DayEndSettlement, { OrderTable, PaymentTable } from "@/pages/DayEndSettlement";
import type { DayEndOrderRow, DayEndPaymentRow } from "@/lib/odoo-api";

const getDayEndSummary = vi.hoisted(() => vi.fn());

vi.mock("@/lib/odoo-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/odoo-api")>();
  return {
    ...original,
    hasOdooBackend: true,
    getDayEndSummary,
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
};

describe("DayEndSettlement order table", () => {
  beforeEach(() => getDayEndSummary.mockReset());

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
    expect(within(table).getByText("HK$600.00")).toBeVisible();
  });

  it("uses A plus B payment buckets and labels order value without claiming revenue", async () => {
    getDayEndSummary.mockResolvedValue({
      date: "2026-08-27",
      timezone: "Asia/Hong_Kong",
      generatedAt: "2026-08-27T18:00:00+08:00",
      odooAvailable: true,
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
    expect(screen.getAllByText("HK$600.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("HK$1,000.00").length).toBeGreaterThanOrEqual(1);
  });

  it("hides every official metric and table when Odoo is unavailable", async () => {
    getDayEndSummary.mockResolvedValue({
      date: "2026-08-27",
      timezone: "Asia/Hong_Kong",
      generatedAt: "2026-08-27T18:00:00+08:00",
      odooAvailable: false,
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
});
