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
      customerEmail: "accounts@example.com",
      billingAddress: "香港中環花園道 1 號",
      customerGroup: "Corporate",
      senderDoNumber: "SDO-100",
      recipientDoNumber: "RDO-200",
      sourceReference: "PO-300",
      department: "Marketing",
      terms: "Net 30",
      lines: [{
        name: "玫瑰花束",
        quantity: 1,
        unitPrice: 680,
        subtotal: 680,
        itemCode: "ROSE-01",
        packing: "禮盒",
        remarks: "白色絲帶",
      }],
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

    const panel = screen.getByRole("complementary", { name: "客戶記錄面板" });
    expect(panel).toHaveClass("fixed", "inset-y-0", "left-0", "lg:sticky");

    expect(screen.getByRole("separator", {
      name: "上下拖拉以調整客戶資料與購買記錄高度",
    })).toBeVisible();
    expect(screen.getByRole("button", { name: "關閉客戶記錄" })).toBeVisible();
    expect(screen.getByRole("button", {
      name: "使用過往地址 中環皇后大道中 1 號",
    })).toBeVisible();
    expect(screen.getByText("收花人長期備註：到達前先致電")).toBeVisible();

    fireEvent.click(screen.getByRole("button", {
      name: "使用過往地址 中環皇后大道中 1 號",
    }));
    expect(onUseAddress).toHaveBeenCalledWith({
      address: "中環皇后大道中 1 號",
      recipientType: "personal",
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
    expect(screen.getByText("accounts@example.com")).toBeVisible();
    expect(screen.getByText("香港中環花園道 1 號")).toBeVisible();
    expect(screen.getByText("Corporate")).toBeVisible();
    expect(screen.getByText("Marketing")).toBeVisible();
    expect(screen.queryByText("PO-300")).not.toBeInTheDocument();
    expect(screen.queryByText("Net 30")).not.toBeInTheDocument();
    expect(screen.getByText("白色絲帶")).toBeVisible();
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
      recipientType: "personal",
      recipientName: "李先生",
      recipientPhone: "62345678",
      shippingPartnerId: undefined,
    });
  });

  it("keeps company and personal recipients separate and reuses the company snapshot", () => {
    const onUseAddress = vi.fn();
    const mixedRecipientCustomer: DemoCustomer = {
      ...customer,
      history: [
        {
          ...customer.history[0],
          shippingPartnerId: undefined,
          deliveryAddress: "中環同一大廈",
          recipientType: "company",
          recipientCompanyName: "Recipient Limited",
          recipientName: "陳小姐",
        },
        {
          ...customer.history[0],
          id: 3,
          shippingPartnerId: undefined,
          deliveryAddress: "中環同一大廈",
          recipientType: "personal",
          recipientCompanyName: undefined,
          recipientName: "陳小姐",
        },
      ],
    };

    render(
      <CustomerHistoryPanel
        customer={mixedRecipientCustomer}
        onClose={vi.fn()}
        onUseAddress={onUseAddress}
      />,
    );

    const choices = screen.getAllByRole("button", { name: "使用過往地址 中環同一大廈" });
    expect(choices).toHaveLength(2);
    expect(screen.getByText("公司：Recipient Limited")).toBeVisible();
    fireEvent.click(choices[0]);
    expect(onUseAddress).toHaveBeenCalledWith(expect.objectContaining({
      recipientType: "company",
      recipientCompanyName: "Recipient Limited",
      recipientName: "陳小姐",
    }));
  });

  it("keeps the newest explicit birthday clear when duplicate addresses are merged", () => {
    const onUseAddress = vi.fn();
    const duplicateCustomer: DemoCustomer = {
      ...customer,
      history: [
        {
          ...customer.history[0],
          id: 10,
          date: "2026-07-17",
          deliveryAddress: "中環同一地址",
          recipientBirthday: "1990-01-02",
        },
        {
          ...customer.history[0],
          id: 11,
          date: "2026-07-18",
          deliveryAddress: "中環同一地址",
          recipientBirthday: "",
        },
      ],
    };

    render(
      <CustomerHistoryPanel
        customer={duplicateCustomer}
        onClose={vi.fn()}
        onUseAddress={onUseAddress}
      />,
    );

    const choice = screen.getByRole("button", { name: "使用過往地址 中環同一地址" });
    fireEvent.click(choice);
    expect(onUseAddress).toHaveBeenCalledWith(expect.objectContaining({
      recipientBirthday: "",
    }));
  });

  it("can inherit an older birthday when the newest legacy snapshot omitted the field", () => {
    const onUseAddress = vi.fn();
    const newestLegacyRecord = {
      ...customer.history[0],
      id: 21,
      date: "2026-07-18",
      deliveryAddress: "金鐘同一地址",
    };
    delete newestLegacyRecord.recipientBirthday;
    const duplicateCustomer: DemoCustomer = {
      ...customer,
      history: [
        {
          ...customer.history[0],
          id: 20,
          date: "2026-07-17",
          deliveryAddress: "金鐘同一地址",
          recipientBirthday: "1985-11-12",
        },
        newestLegacyRecord,
      ],
    };

    render(
      <CustomerHistoryPanel
        customer={duplicateCustomer}
        onClose={vi.fn()}
        onUseAddress={onUseAddress}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "使用過往地址 金鐘同一地址" }));
    expect(onUseAddress).toHaveBeenCalledWith(expect.objectContaining({
      recipientBirthday: "1985-11-12",
    }));
  });

  it("shows all saved delivery addresses only after the compact view is expanded", () => {
    const manyAddressCustomer: DemoCustomer = {
      ...customer,
      history: Array.from({ length: 5 }, (_, index) => ({
        ...customer.history[0],
        id: index + 1,
        deliveryAddress: `測試地址 ${index + 1}`,
        recipientName: `收貨人 ${index + 1}`,
        recipientPhone: `6123456${index}`,
        shippingPartnerId: index + 80,
      })),
    };

    render(
      <CustomerHistoryPanel
        customer={manyAddressCustomer}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "使用過往地址 測試地址 3" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "使用過往地址 測試地址 4" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看全部 5 個地址" }));

    expect(screen.getByRole("button", { name: "使用過往地址 測試地址 4" })).toBeVisible();
    expect(screen.getByRole("button", { name: "收起地址" })).toBeVisible();
  });

  it("does not present the legacy NEW placeholder as a real salesperson", () => {
    const legacySalespersonCustomer: DemoCustomer = {
      ...customer,
      history: [{ ...customer.history[0], salesperson: "NEW" }],
    };

    render(
      <CustomerHistoryPanel
        customer={legacySalespersonCustomer}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /查看呢位客人過往消費紀錄/ }));

    expect(screen.getByText("銷售：舊資料未有記錄")).toBeVisible();
    expect(screen.queryByText("銷售：NEW")).not.toBeInTheDocument();
  });

  it("shows a deposit as partially paid rather than fully paid", () => {
    render(
      <CustomerHistoryPanel
        customer={{
          ...customer,
          history: [{ ...customer.history[0], status: "deposit" }],
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /查看呢位客人過往消費紀錄/ }));

    expect(screen.getByText("已付訂金")).toBeVisible();
    expect(screen.queryByText("已付")).not.toBeInTheDocument();
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
