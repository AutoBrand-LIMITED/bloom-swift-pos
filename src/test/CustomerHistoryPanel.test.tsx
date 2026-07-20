import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CustomerHistoryPanel from "@/components/pos/CustomerHistoryPanel";
import type { DemoCustomer } from "@/data/demo-customers";

const odooApiMocks = vi.hoisted(() => ({
  getOdooCustomerHistory: vi.fn(),
}));

vi.mock("@/lib/odoo-api", () => ({
  getOdooCustomerHistory: odooApiMocks.getOdooCustomerHistory,
  hasOdooBackend: true,
}));

const customer: DemoCustomer = {
  id: "customer-1",
  name: "測試客人",
  phone: "91234567",
  historyCount: 2,
  history: [
    {
      id: 1,
      date: "2026-07-18",
      invoiceNumber: "INV-TEST-1",
      items: "玫瑰花束",
      total: 680,
      status: "paid",
      deliveryAddress: "中環皇后大道中 1 號",
      recipientName: "陳小姐",
      recipientPhone: "61234567",
      shippingPartnerId: 84,
      recipientContactNote: "到達前先致電",
    },
    {
      id: 2,
      date: "2026-07-17",
      invoiceNumber: "INV-TEST-2",
      items: "百合花束",
      total: 880,
      status: "paid",
      deliveryAddress: "金鐘道 88 號",
      recipientName: "李先生",
      recipientPhone: "62345678",
    },
  ],
};

describe("CustomerHistoryPanel resizable history", () => {
  beforeEach(() => {
    odooApiMocks.getOdooCustomerHistory.mockReset();
  });

  it("keeps addresses and history in vertically resizable panes", () => {
    const onUseAddress = vi.fn();
    render(
      <CustomerHistoryPanel
        customer={customer}
        onClose={vi.fn()}
        onUseAddress={onUseAddress}
      />,
    );

    expect(screen.getByRole("separator", {
      name: "上下拖拉以調整客戶資料與購買記錄高度",
    })).toBeVisible();
    expect(screen.getByRole("button", {
      name: "使用過往地址 中環皇后大道中 1 號",
    })).toBeVisible();
    expect(screen.getByText("收花人長期備註：到達前先致電")).toBeVisible();

    fireEvent.click(screen.getByRole("button", {
      name: "使用過往地址 中環皇后大道中 1 號",
    }));
    expect(onUseAddress).toHaveBeenCalledWith({
      address: "中環皇后大道中 1 號",
      recipientName: "陳小姐",
      recipientPhone: "61234567",
      shippingPartnerId: 84,
    });

    fireEvent.click(screen.getByRole("button", { name: /查看呢位客人過往消費紀錄/ }));

    expect(screen.getByText("INV-TEST-1")).toBeVisible();
    expect(screen.getByText("INV-TEST-2")).toBeVisible();

    fireEvent.click(screen.getAllByRole("button", { name: "詳情" })[0]);
    expect(screen.getByText("收花人長期備註：")).toBeVisible();
    expect(screen.getByText("到達前先致電")).toBeVisible();
  });

  it("keeps different recipients at the same address as separate choices", () => {
    const onUseAddress = vi.fn();
    const sameAddressCustomer: DemoCustomer = {
      ...customer,
      history: [
        {
          ...customer.history[0],
          shippingPartnerId: undefined,
          deliveryAddress: "中環同一大廈",
          recipientName: "陳小姐",
          recipientPhone: "61234567",
        },
        {
          ...customer.history[1],
          shippingPartnerId: undefined,
          deliveryAddress: "中環同一大廈",
          recipientName: "李先生",
          recipientPhone: "62345678",
        },
      ],
    };

    render(
      <CustomerHistoryPanel
        customer={sameAddressCustomer}
        onClose={vi.fn()}
        onUseAddress={onUseAddress}
      />,
    );

    const choices = screen.getAllByRole("button", { name: "使用過往地址 中環同一大廈" });
    expect(choices).toHaveLength(2);
    fireEvent.click(choices[1]);
    expect(onUseAddress).toHaveBeenCalledWith({
      address: "中環同一大廈",
      recipientName: "李先生",
      recipientPhone: "62345678",
      shippingPartnerId: undefined,
    });
  });

  it("shows an explicit unavailable state and retries Odoo history", async () => {
    const remoteCustomer: DemoCustomer = {
      ...customer,
      id: "odoo-customer",
      odooPartnerId: 42,
      history: [],
      historyCount: 0,
      totalSpent: 0,
    };
    odooApiMocks.getOdooCustomerHistory
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        history: [customer.history[0]],
        historyCount: 1,
        totalSpent: 680,
      });

    render(
      <CustomerHistoryPanel
        customer={remoteCustomer}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("暫時未能確認");
    expect(screen.getAllByText("未確認")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "重新載入" }));

    await waitFor(() => expect(odooApiMocks.getOdooCustomerHistory).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText("$680")).toBeVisible();
  });
});
