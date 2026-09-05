import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OrderHistory from "@/components/pos/OrderHistory";
import type { OrderRecordView } from "@/lib/order-records";

const {
  cancelOdooOrder,
  getAccountingPaymentOptions,
  getDeliverySlots,
  getOdooOrderEditHistory,
  getOdooCustomerGroups,
  getOdooEmployees,
  getOdooProducts,
  getOdooSalesTeams,
  previewOdooOrderProductCorrection,
  applyOdooOrderProductCorrection,
  recordOdooOrderPayment,
  updateOdooOrderSection,
} = vi.hoisted(() => ({
  cancelOdooOrder: vi.fn(),
  getAccountingPaymentOptions: vi.fn(),
  getDeliverySlots: vi.fn(),
  getOdooOrderEditHistory: vi.fn(),
  getOdooCustomerGroups: vi.fn(),
  getOdooEmployees: vi.fn(),
  getOdooProducts: vi.fn(),
  getOdooSalesTeams: vi.fn(),
  previewOdooOrderProductCorrection: vi.fn(),
  applyOdooOrderProductCorrection: vi.fn(),
  recordOdooOrderPayment: vi.fn(),
  updateOdooOrderSection: vi.fn(),
}));

vi.mock("@/lib/odoo-api", () => ({
  hasOdooBackend: true,
  cancelOdooOrder,
  getAccountingPaymentOptions,
  getDeliverySlots,
  getOdooOrderEditHistory,
  getOdooCustomerGroups,
  getOdooEmployees,
  getOdooProducts,
  getOdooSalesTeams,
  previewOdooOrderProductCorrection,
  applyOdooOrderProductCorrection,
  recordOdooOrderPayment,
  updateOdooOrderSection,
}));

const orderFixture = (overrides: Partial<OrderRecordView> = {}): OrderRecordView => ({
  source: "odoo",
  syncState: "synced",
  id: "order-1",
  odooOrderId: 17,
  odooOrderName: "S00017",
  writeDate: "2026-08-03 10:00:00",
  salesId: "S001",
  customerName: "測試客人",
  phone: "91234567",
  items: [{ id: "line-1", name: "花束", price: 680, quantity: 1 }],
  deliveryFee: 0,
  urgentFee: 0,
  subtotal: 680,
  finalPrice: 680,
  priceOverridden: false,
  paymentStatus: "paid",
  depositAmount: 0,
  paymentMethod: "cash_other",
  deliveryDate: "2026-07-18",
  deliveryTimeMode: "slot",
  deliverySlotId: 11,
  deliveryTime: "上午 09:00-13:00",
  deliveryAddress: "中環",
  recipientName: "收花人",
  recipientPhone: "61234567",
  deliveryPerson: "Driver",
  giftCardEnabled: false,
  giftCardMessage: "",
  senderNote: "",
  deliveryNote: "",
  internalNote: "",
  createdAt: "2026-07-16T09:00:00+08:00",
  ...overrides,
});

const openOrderDetails = (orderName = "S00017") => {
  const orderButton = screen.queryByRole("button", { name: `查看訂單 ${orderName}` });
  if (orderButton) fireEvent.click(orderButton);
};

const openOrderEditSection = (menuItemName: string) => {
  openOrderDetails();
  fireEvent.keyDown(screen.getByRole("button", { name: "編輯訂單資料" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: menuItemName }));
};

describe("OrderHistory delivery summary", () => {
  beforeEach(() => {
    cancelOdooOrder.mockReset();
    getDeliverySlots.mockReset();
    getDeliverySlots.mockResolvedValue([
      { id: 11, displayLabel: "上午 09:00-13:00", startTime: "09:00", endTime: "13:00" },
      { id: 12, displayLabel: "下午 13:00-18:00", startTime: "13:00", endTime: "18:00" },
    ]);
    getOdooOrderEditHistory.mockReset();
    getOdooOrderEditHistory.mockImplementation(() => new Promise(() => {}));
    getOdooEmployees.mockReset();
    getOdooEmployees.mockResolvedValue([]);
    getOdooProducts.mockReset();
    getOdooProducts.mockResolvedValue([]);
    getOdooSalesTeams.mockReset();
    getOdooSalesTeams.mockResolvedValue([]);
    getOdooCustomerGroups.mockReset();
    getOdooCustomerGroups.mockResolvedValue([]);
    updateOdooOrderSection.mockReset();
    getAccountingPaymentOptions.mockReset();
    getAccountingPaymentOptions.mockResolvedValue([
      { code: "cash_other", label: "現金／其他" },
      { code: "bank_in_fps", label: "轉數快" },
    ]);
    recordOdooOrderPayment.mockReset();
    previewOdooOrderProductCorrection.mockReset();
    applyOdooOrderProductCorrection.mockReset();
  });

  it("uses a Shopify-style full-width order index before opening a full-page detail", () => {
    const orders = Array.from({ length: 20 }, (_, index) => orderFixture({
      id: `order-${index + 1}`,
      odooOrderName: `S${String(index + 1).padStart(5, "0")}`,
      customerName: `客人 ${index + 1}`,
    }));

    render(<OrderHistory orders={orders} open onClose={vi.fn()} />);

    expect(screen.getByText("訂單記錄 (20)")).toBeVisible();
    expect(screen.getByRole("main", { name: "訂單列表" })).toHaveClass("w-full");
    expect(screen.getByTestId("order-history-scroll-area")).toHaveClass("min-h-0", "flex-1");
    expect(screen.getByRole("tab", { name: "全部訂單 20" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("訂單")).toBeVisible();
    expect(screen.getByText("落單時間")).toBeVisible();
    expect(screen.getByText("客戶")).toBeVisible();
    expect(screen.getByText("送貨／自取")).toBeVisible();
    expect(screen.getByText("訂單狀態")).toBeVisible();
    expect(screen.getByText("總額／操作")).toBeVisible();
    expect(screen.getByRole("button", { name: "全部列印訂單 S00020" })).toBeVisible();
    expect(screen.queryByTestId("order-history-detail-pane")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看訂單 S00020" }));
    expect(screen.getByTestId("order-history-detail-pane")).toHaveClass("overflow-y-auto");
    expect(screen.queryByRole("main", { name: "訂單列表" })).not.toBeInTheDocument();
  });

  it("shows only the final cancelled or refunded status instead of the old payment status", () => {
    const cancelledOrder = orderFixture({
      id: "cancelled-order",
      odooOrderName: "S17840",
      orderState: "cancel",
      cancellationResolution: "credit",
      cancellationStatus: "credit_used",
    });
    const refundedOrder = orderFixture({
      id: "refunded-order",
      odooOrderName: "S17842",
      orderState: "cancel",
      cancellationResolution: "refund",
      cancellationStatus: "refunded",
    });

    render(<OrderHistory orders={[cancelledOrder, refundedOrder]} open onClose={vi.fn()} />);

    const cancelledRow = screen.getByRole("button", { name: "查看訂單 S17840" });
    expect(within(cancelledRow).getByText("已取消")).toBeVisible();
    expect(within(cancelledRow).queryByText("已付款")).not.toBeInTheDocument();

    const refundedRow = screen.getByRole("button", { name: "查看訂單 S17842" });
    expect(within(refundedRow).getByText("已退款")).toBeVisible();
    expect(within(refundedRow).queryByText("已付款")).not.toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "已付款 0" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "已取消 1" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "已退款 1" })).toBeVisible();

    fireEvent.click(cancelledRow);
    const detail = screen.getByTestId("order-history-detail-pane");
    expect(within(detail).getAllByText("已取消").length).toBeGreaterThan(0);
    expect(within(detail).queryByText("已付款")).not.toBeInTheDocument();
  });

  it("places edit and print actions in the top summary and removes the bottom operation section", () => {
    render(<OrderHistory orders={[orderFixture()]} open onClose={vi.fn()} />);
    openOrderDetails();

    const editButton = screen.getByRole("button", { name: "編輯訂單資料" });
    const printAllButton = screen.getByRole("button", { name: "全部列印" });
    const identitySection = screen.getByRole("region", { name: "訂單身份與時間" });
    expect(editButton.compareDocumentPosition(identitySection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(printAllButton.compareDocumentPosition(identitySection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "產品與價錢" }))
      .getByRole("button", { name: "修改商品／計算差額" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "操作" })).not.toBeInTheDocument();
  });

  it("previews and posts an auditable product correction", async () => {
    getOdooProducts.mockResolvedValue([{
      id: 301,
      name: "花束",
      price: 680,
      productCode: "B001",
      imageUrl: "",
      categoryId: 8,
      categoryName: "花束",
      templateId: 300,
      barcode: null,
      availableInPos: true,
      displaySequence: 1,
      availableFrom: null,
      availableUntil: null,
    }]);
    previewOdooOrderProductCorrection.mockResolvedValue({
      orderId: 17,
      orderName: "S00017",
      sourceRevision: "2026-08-03 10:00:01",
      oldTotalMinor: 68000,
      newTotalMinor: 136000,
      creditAmountMinor: 0,
      chargeAmountMinor: 68000,
      netDeltaMinor: 68000,
      amountResidualMinor: 68000,
      customerCreditMinor: 0,
      creditLines: [],
      chargeLines: [],
    });
    applyOdooOrderProductCorrection.mockResolvedValue({
      idempotentReplay: false,
      correction: { id: 9, name: "PCOR/2026/00009" },
      orderId: 17,
      orderName: "S00017",
      writeDate: "2026-08-03 10:00:02",
      oldTotalMinor: 68000,
      newTotalMinor: 136000,
      creditAmountMinor: 0,
      chargeAmountMinor: 68000,
      netDeltaMinor: 68000,
      amountResidualMinor: 68000,
      customerCreditMinor: 0,
      settlementDisposition: "customer_credit",
      creditNote: null,
      supplementInvoice: { id: 88, name: "INV/2026/00088" },
    });
    const onOrderUpdated = vi.fn();
    render(<OrderHistory
      orders={[orderFixture({
        items: [{
          id: "line-1",
          name: "花束",
          price: 680,
          quantity: 1,
          productId: 301,
          productCode: "B001",
          catalogPrice: 680,
          discountPercent: 0,
        }],
      })]}
      open
      onClose={vi.fn()}
      onOrderUpdated={onOrderUpdated}
    />);
    openOrderDetails();

    fireEvent.click(within(screen.getByRole("region", { name: "產品與價錢" }))
      .getByRole("button", { name: "修改商品／計算差額" }));
    expect(await screen.findByRole("heading", { name: "修改訂單商品 · S00017" })).toBeVisible();
    expect(screen.getByRole("dialog")).toHaveClass("h-[92dvh]", "overflow-hidden");
    expect(screen.getByRole("region", { name: "商品修改內容" })).toHaveClass(
      "min-h-0",
      "flex-1",
      "touch-pan-y",
      "overflow-y-auto",
    );
    fireEvent.click(screen.getByRole("button", { name: "增加 花束 數量" }));
    expect(screen.getByText("多咗 HK$680.00，需要向客戶補收")).toBeVisible();

    await waitFor(() => expect(previewOdooOrderProductCorrection).toHaveBeenCalledWith(
      17,
      expect.objectContaining({
        expectedWriteDate: "2026-08-03 10:00:00",
        items: [expect.objectContaining({ id: "line-1", productId: 301, quantity: 2 })],
      }),
      expect.any(AbortSignal),
    ));
    expect(await screen.findByText("HK$1,360.00")).toBeVisible();
    fireEvent.change(screen.getByLabelText("修改原因 *"), {
      target: { value: "客人追加一份花束" },
    });
    fireEvent.click(screen.getByRole("button", { name: "確認修改並入帳" }));

    await waitFor(() => expect(applyOdooOrderProductCorrection).toHaveBeenCalledWith(
      17,
      expect.objectContaining({
        expectedWriteDate: "2026-08-03 10:00:01",
        reason: "客人追加一份花束",
        settlementDisposition: "customer_credit",
      }),
    ));
    expect(onOrderUpdated).toHaveBeenCalledTimes(1);
  });

  it("shows a product replacement and calculates the increase automatically", async () => {
    getOdooProducts.mockResolvedValue([{
      id: 302,
      name: "百合花束",
      price: 800,
      productCode: "LILY",
      imageUrl: "",
      categoryId: 8,
      categoryName: "花束",
      templateId: 302,
      barcode: null,
      availableInPos: true,
      displaySequence: 1,
      availableFrom: null,
      availableUntil: null,
    }]);
    previewOdooOrderProductCorrection.mockResolvedValue({
      orderId: 17,
      orderName: "S00017",
      sourceRevision: "2026-08-03 10:00:01",
      oldTotalMinor: 68000,
      newTotalMinor: 80000,
      creditAmountMinor: 68000,
      chargeAmountMinor: 80000,
      netDeltaMinor: 12000,
      amountResidualMinor: 12000,
      customerCreditMinor: 0,
      creditLines: [],
      chargeLines: [],
    });
    render(<OrderHistory
      orders={[orderFixture({
        items: [{
          id: "line-1",
          name: "花束",
          price: 680,
          quantity: 1,
          catalogPrice: 680,
          discountPercent: 0,
        }],
      })]}
      open
      onClose={vi.fn()}
    />);
    openOrderDetails();

    fireEvent.click(within(screen.getByRole("region", { name: "產品與價錢" }))
      .getByRole("button", { name: "修改商品／計算差額" }));
    fireEvent.click(await screen.findByRole("button", { name: "更換 花束" }));
    fireEvent.click(await screen.findByRole("button", { name: "以 百合花束 更換目前商品" }));

    expect(screen.getByText("更換商品")).toBeVisible();
    expect(screen.getByText("花束 × 1")).toBeVisible();
    expect(screen.getByText("百合花束 × 1")).toBeVisible();
    expect(screen.getByText("多咗 HK$120.00，需要向客戶補收")).toBeVisible();
    await waitFor(() => expect(previewOdooOrderProductCorrection).toHaveBeenCalledWith(
      17,
      expect.objectContaining({
        items: [expect.objectContaining({
          id: "line-1",
          productId: 302,
          name: "百合花束",
        })],
      }),
      expect.any(AbortSignal),
    ));
  });

  it("labels a removed product and calculates the reduction automatically", async () => {
    previewOdooOrderProductCorrection.mockResolvedValue({
      orderId: 17,
      orderName: "S00017",
      sourceRevision: "2026-08-03 10:00:01",
      oldTotalMinor: 80300,
      newTotalMinor: 68000,
      creditAmountMinor: 12300,
      chargeAmountMinor: 0,
      netDeltaMinor: -12300,
      amountResidualMinor: 0,
      customerCreditMinor: 12300,
      creditLines: [],
      chargeLines: [],
    });
    render(<OrderHistory
      orders={[orderFixture({
        items: [
          {
            id: "line-1",
            name: "花束",
            price: 680,
            quantity: 1,
            productId: 301,
            productCode: "B001",
            catalogPrice: 680,
            discountPercent: 0,
          },
          {
            id: "line-2",
            name: "朱古力",
            price: 123,
            quantity: 1,
            productId: 402,
            productCode: "CHOCO",
            catalogPrice: 123,
            discountPercent: 0,
          },
        ],
      })]}
      open
      onClose={vi.fn()}
    />);
    openOrderDetails();

    fireEvent.click(within(screen.getByRole("region", { name: "產品與價錢" }))
      .getByRole("button", { name: "修改商品／計算差額" }));
    fireEvent.click(await screen.findByRole("button", { name: "刪除 朱古力" }));

    expect(screen.getByText("刪除商品")).toBeVisible();
    expect(screen.getByText("少咗 HK$123.00，需要退款或保留 Customer Credit")).toBeVisible();
    await waitFor(() => expect(previewOdooOrderProductCorrection).toHaveBeenCalledWith(
      17,
      expect.objectContaining({
        items: [expect.objectContaining({ id: "line-1", productId: 301 })],
      }),
      expect.any(AbortSignal),
    ));
  });

  it("lets a Junior edit only their own order and lets a Manager edit another employee order", () => {
    const ownOrder = orderFixture({ operatorEmployeeId: 95 });
    const { rerender } = render(
      <OrderHistory
        orders={[ownOrder]}
        open
        onClose={vi.fn()}
        currentEmployeeId={95}
        currentEmployeeRole="staff"
      />,
    );
    openOrderDetails();
    expect(screen.getByRole("button", { name: "編輯訂單資料" })).toBeEnabled();

    const anotherEmployeeOrder = orderFixture({ operatorEmployeeId: 174 });
    rerender(
      <OrderHistory
        orders={[anotherEmployeeOrder]}
        open
        onClose={vi.fn()}
        currentEmployeeId={95}
        currentEmployeeRole="staff"
      />,
    );
    expect(screen.getByRole("button", { name: "編輯訂單資料" })).toBeDisabled();
    expect(screen.getByText("Junior 員工只可以修改自己開立嘅訂單。")).toBeVisible();
    expect(screen.queryByRole("button", { name: "客戶與送花人操作選單" })).not.toBeInTheDocument();

    rerender(
      <OrderHistory
        orders={[anotherEmployeeOrder]}
        open
        onClose={vi.fn()}
        currentEmployeeId={95}
        currentEmployeeRole="manager"
      />,
    );
    expect(screen.getByRole("button", { name: "編輯訂單資料" })).toBeEnabled();
    expect(screen.queryByText("Junior 員工只可以修改自己開立嘅訂單。")).not.toBeInTheDocument();
  });

  it("hard-locks an order after seven days even for a Manager", () => {
    render(
      <OrderHistory
        orders={[orderFixture({
          operatorEmployeeId: 174,
          editLocked: true,
          editableUntil: "2026-07-22",
        })]}
        open
        onClose={vi.fn()}
        currentEmployeeId={95}
        currentEmployeeRole="manager"
      />,
    );

    openOrderDetails();
    expect(screen.getByRole("button", { name: "編輯訂單資料" })).toBeDisabled();
    expect(screen.getByText("已鎖單")).toBeVisible();
    expect(screen.getByText(/任何人都唔可以直接改原單/)).toBeVisible();
    expect(screen.getByRole("button", { name: "取消訂單／建立替代單" })).toBeEnabled();
  });

  it("lets a Manager cancel a paid order to Customer Credit and start a linked replacement", async () => {
    cancelOdooOrder.mockResolvedValue({
      idempotentReplay: false,
      orderId: 17,
      orderName: "S00017",
      resolution: "credit",
      status: "credit_available",
      creditNote: { id: 71, name: "RINV/2026/00071" },
      creditBalanceMinor: 68000,
      writeDate: "2026-08-03 10:02:00",
    });
    const onOrderUpdated = vi.fn();
    const onStartReplacement = vi.fn();
    const paidOrder = orderFixture({ operatorEmployeeId: 174, customerId: 42 });
    render(
      <OrderHistory
        orders={[paidOrder]}
        open
        onClose={vi.fn()}
        currentEmployeeId={95}
        currentEmployeeRole="manager"
        onOrderUpdated={onOrderUpdated}
        onStartReplacement={onStartReplacement}
      />,
    );

    openOrderDetails();
    fireEvent.click(screen.getByRole("button", { name: "取消訂單／建立替代單" }));
    expect(screen.getByRole("radio", { name: /保留 Customer Credit/ })).toBeChecked();
    fireEvent.change(screen.getByLabelText("取消原因 *"), {
      target: { value: "  客人要改送貨日期  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "確認取消" }));

    await waitFor(() => {
      expect(cancelOdooOrder).toHaveBeenCalledWith(17, {
        resolution: "credit",
        reason: "客人要改送貨日期",
      });
    });
    expect(onOrderUpdated).toHaveBeenCalledTimes(1);
    expect(onStartReplacement).toHaveBeenCalledWith(paidOrder, "credit");
  });

  it("opens only the requested section from its three-dot action menu", () => {
    render(<OrderHistory orders={[orderFixture()]} open onClose={vi.fn()} />);
    openOrderDetails();

    fireEvent.keyDown(screen.getByRole("button", { name: "客戶與送花人操作選單" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "修改客戶與送花人" }));

    expect(screen.getByRole("heading", { name: /修改客戶與送花人/ })).toBeVisible();
    expect(screen.getByLabelText("下單人／客戶名稱 *")).toBeVisible();
    expect(screen.queryByLabelText("送貨地址 *")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("內部備註")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("付款參考編號 *")).not.toBeInTheDocument();
    expect(getDeliverySlots).not.toHaveBeenCalled();
    expect(getAccountingPaymentOptions).not.toHaveBeenCalled();
  });

  it("validates only fields owned by the focused customer section", async () => {
    render(<OrderHistory orders={[orderFixture()]} open onClose={vi.fn()} />);

    openOrderEditSection("修改客戶與送花人");
    fireEvent.change(screen.getByLabelText("客戶電郵"), { target: { value: "invalid-email" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("有效嘅客戶電郵");
    expect(updateOdooOrderSection).not.toHaveBeenCalled();
  });

  it("saves notes without validating unrelated legacy customer or delivery fields", async () => {
    updateOdooOrderSection.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    render(<OrderHistory orders={[orderFixture({
      phone: "",
      deliveryDate: "",
      deliveryAddress: "",
      recipientName: "",
      recipientPhone: "",
    })]} open onClose={vi.fn()} />);

    openOrderDetails();
    fireEvent.keyDown(screen.getByRole("button", { name: "備註操作選單" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "修改備註及心意卡" }));
    fireEvent.change(screen.getByLabelText("內部備註"), { target: { value: "只更新備註" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => expect(updateOdooOrderSection).toHaveBeenCalledWith(
      17,
      {
        section: "notes",
        data: expect.objectContaining({ internalNote: "只更新備註" }),
      },
    ));
  });

  it("shows new occasions and converted legacy birthdays in history snapshots", () => {
    render(<OrderHistory orders={[
      orderFixture({
        id: "new-occasion",
        odooOrderName: "S-NEW-OCCASION",
        recipientOccasions: [
          { type: "anniversary", date: "2020-06-18" },
          { type: "other", label: "相識紀念日", date: "2021-09-01" },
        ],
      }),
      orderFixture({
        id: "legacy-birthday",
        odooOrderName: "S-LEGACY-BIRTHDAY",
        recipientBirthday: "1990-01-02",
      }),
    ]} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "查看訂單 S-NEW-OCCASION" }));
    expect(screen.getByText(/週年：2020-06-18/)).toBeInTheDocument();
    expect(screen.getByText(/相識紀念日：2021-09-01/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回訂單列表" }));
    fireEvent.click(screen.getByRole("button", { name: "查看訂單 S-LEGACY-BIRTHDAY" }));
    expect(screen.getByText(/收件人生日：1990-01-02/)).toBeInTheDocument();
  });

  it("offers an optional order-date filter and can clear a date-scoped search", () => {
    const onSearchQueryChange = vi.fn();
    const onSelectedDateChange = vi.fn();
    render(
      <OrderHistory
        orders={[]}
        open
        onClose={vi.fn()}
        selectedDate="2026-07-19"
        onSelectedDateChange={onSelectedDateChange}
        searchQuery="accounts@example.com"
        onSearchQueryChange={onSearchQueryChange}
        searchPhase="success"
      />,
    );

    const dateInput = screen.getByLabelText("落單日期（選填）");
    expect(dateInput).toHaveAttribute("type", "date");
    expect(dateInput).toHaveValue("2026-07-19");
    expect(dateInput).toHaveClass("min-h-11", "touch-manipulation");
    fireEvent.change(dateInput, { target: { value: "2026-07-18" } });
    expect(onSelectedDateChange).toHaveBeenCalledWith("2026-07-18");
    expect(screen.getByRole("textbox", { name: "搜尋訂單" })).toHaveValue("accounts@example.com");
    expect(screen.getByText("2026-07-19 搜尋結果：0 筆")).toBeVisible();
    expect(screen.getByText("未找到 2026-07-19 符合資料的訂單")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "清除落單日期篩選" }));
    expect(onSelectedDateChange).toHaveBeenCalledWith("");
    fireEvent.click(screen.getByRole("button", { name: "清除訂單搜尋" }));
    expect(onSearchQueryChange).toHaveBeenCalledWith("");
    expect(onSelectedDateChange).toHaveBeenCalledTimes(2);
  });

  it("shows newest-first guidance and cross-date search when no date is selected", () => {
    const { rerender } = render(
      <OrderHistory
        orders={[orderFixture()]}
        open
        onClose={vi.fn()}
        selectedDate=""
        onSelectedDateChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("落單日期（選填）")).toHaveValue("");
    expect(screen.getByPlaceholderText("搜尋訂單號碼、電話、電郵、客戶或地址")).toBeVisible();
    expect(screen.getByText("顯示最新訂單，按落單時間由新至舊排列；日期只在需要時篩選。")).toBeVisible();

    rerender(
      <OrderHistory
        orders={[orderFixture()]}
        open
        onClose={vi.fn()}
        selectedDate=""
        searchQuery="S00017"
        onSearchQueryChange={vi.fn()}
        searchPhase="success"
      />,
    );
    expect(screen.getByText("跨日期搜尋結果：1 筆")).toBeVisible();
  });

  it("does not show a stale count or false zero while a remote search is unsettled", () => {
    const { rerender } = render(
      <OrderHistory
        orders={[]}
        open
        onClose={vi.fn()}
        selectedDate="2026-07-19"
        searchQuery="Wong"
        onSearchQueryChange={vi.fn()}
        searchPhase="debouncing"
      />,
    );

    expect(screen.getByText("訂單記錄")).toBeVisible();
    expect(screen.getAllByText("等待搜尋 2026-07-19 的訂單...").length).toBeGreaterThan(0);
    expect(screen.queryByText("未找到 2026-07-19 符合資料的訂單")).not.toBeInTheDocument();
    expect(screen.queryByText(/2026-07-19 搜尋結果/)).not.toBeInTheDocument();

    rerender(
      <OrderHistory
        orders={[]}
        open
        onClose={vi.fn()}
        selectedDate="2026-07-19"
        searchQuery="Wong"
        onSearchQueryChange={vi.fn()}
        searchPhase="error"
        error="Backend unavailable"
      />,
    );
    expect(screen.getByText("搜尋未完成，請重試")).toBeVisible();
    expect(screen.queryByText("未找到 2026-07-19 符合資料的訂單")).not.toBeInTheDocument();
  });

  it("requires two characters before starting order search", () => {
    render(
      <OrderHistory
        orders={[]}
        open
        onClose={vi.fn()}
        searchQuery="A"
        onSearchQueryChange={vi.fn()}
      />,
    );

    expect(screen.getByText("請輸入至少 2 個字元開始搜尋")).toBeVisible();
  });

  it("shows the delivery date and frozen slot snapshot", () => {
    render(<OrderHistory orders={[orderFixture({ deliveryTimeMode: "slot", deliverySlotId: 11 })]} open onClose={vi.fn()} />);

    const order = screen.getByRole("button", { name: "查看訂單 S00017" });
    expect(within(order).getByText("送貨：2026-07-18")).toBeVisible();
    expect(within(order).getByText("上午 09:00-13:00")).toBeVisible();
  });

  it("labels pickup orders and their store address as pickup", () => {
    render(
      <OrderHistory
        orders={[orderFixture({
          fulfillmentType: "pickup",
          deliveryAddress: "中西花店門市自取",
        })]}
        open
        onClose={vi.fn()}
      />,
    );

    const order = screen.getByRole("button", { name: "查看訂單 S00017" });
    expect(within(order).getByText("自取：2026-07-18")).toBeVisible();
    expect(within(order).getByText("上午 09:00-13:00")).toBeVisible();
    expect(within(order).queryByText("送貨：2026-07-18")).not.toBeInTheDocument();

    fireEvent.click(order);
    const destinations = screen.getByRole("region", { name: "收貨點與商品分配" });
    expect(within(destinations).getByText("自取地點")).toBeVisible();
    expect(within(destinations).getByText("中西花店門市自取")).toBeVisible();
  });

  it("edits an existing Odoo order and refreshes the drawer", async () => {
    updateOdooOrderSection.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    const onOrderUpdated = vi.fn();
    render(
      <OrderHistory
        orders={[orderFixture()]}
        open
        onClose={vi.fn()}
        onOrderUpdated={onOrderUpdated}
      />,
    );

    openOrderDetails();
    expect(screen.getByRole("button", { name: "編輯訂單資料" })).toBeVisible();
    openOrderEditSection("修改收貨點與商品分配");
    expect(screen.getByRole("dialog")).toHaveClass(
      "max-h-[92dvh]",
      "grid-rows-[auto_minmax(0,1fr)_auto]",
    );
    const editScrollArea = screen.getByTestId("order-edit-scroll-area");
    expect(editScrollArea).toHaveClass("max-h-[calc(92dvh-11rem)]", "min-h-0");
    expect(
      editScrollArea.querySelector("[data-radix-scroll-area-viewport]"),
    ).toHaveStyle({ overflowY: "scroll" });
    fireEvent.change(screen.getByLabelText("送貨地址 *"), {
      target: { value: "觀塘新地址" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => {
      expect(updateOdooOrderSection).toHaveBeenCalledWith(
        17,
        {
          section: "delivery",
          data: expect.objectContaining({
            deliveryAddress: "觀塘新地址",
            expectedWriteDate: "2026-08-03 10:00:00",
          }),
        },
      );
    });
    expect(onOrderUpdated).toHaveBeenCalledTimes(1);
  });

  it("keeps historical assignment and customer group values outside the focused customer editor", async () => {
    updateOdooOrderSection.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    render(<OrderHistory orders={[orderFixture({
      customerType: "company",
      companyName: "Flower Company Limited",
      salesId: "AC02 — Elma",
      salespersonEmployeeId: 95,
      salesTeamId: 7,
      department: "Retail",
      customerGroupId: 12,
      customerGroup: "Regular",
    })]} open onClose={vi.fn()} />);

    openOrderDetails();
    const businessDetails = screen.getByRole("region", { name: "業務詳情" });
    expect(within(businessDetails).getByText("AC02 — Elma")).toBeVisible();
    expect(within(businessDetails).getByText("Retail")).toBeVisible();
    expect(within(businessDetails).getByText("Regular")).toBeVisible();

    openOrderEditSection("修改客戶與送花人");
    expect(screen.getByRole("heading", { name: /修改客戶與送花人/ })).toBeVisible();
    expect(screen.queryByLabelText("負責銷售員")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Sales Team")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("客戶群組")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /負責銷售員/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Sales Team/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /客戶群組/ })).not.toBeInTheDocument();
    expect(getOdooEmployees).not.toHaveBeenCalled();
    expect(getOdooSalesTeams).not.toHaveBeenCalled();
    expect(getOdooCustomerGroups).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => expect(updateOdooOrderSection).toHaveBeenCalled());
    const update = updateOdooOrderSection.mock.calls[0][1];
    const payload = update.data;
    expect(update.section).toBe("customer");
    expect(payload).not.toHaveProperty("salesId");
    expect(payload).not.toHaveProperty("department");
    expect(payload).not.toHaveProperty("customerGroup");
    expect(payload).not.toHaveProperty("salespersonEmployeeId");
    expect(payload).not.toHaveProperty("salesTeamId");
    expect(payload).not.toHaveProperty("customerGroupId");
    expect(payload).not.toHaveProperty("deliveryAddress");
    expect(payload).not.toHaveProperty("internalNote");
    expect(payload).toMatchObject({
      customerType: "company",
      companyName: "Flower Company Limited",
    });
  });

  it("edits every existing split destination while preserving IDs and item allocations", async () => {
    updateOdooOrderSection.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    const deliverySplit = {
      id: "destination-2",
      fulfillmentType: "delivery" as const,
      deliveryDate: "2026-07-19",
      deliveryTimeMode: "specified" as const,
      deliveryTime: "下午 4 時前",
      deliveryRegion: "九龍",
      deliveryDistrict: "觀塘區",
      deliveryArea: "觀塘",
      deliveryDetail: "巧明街 6 號",
      deliveryAddress: "九龍觀塘巧明街 6 號",
      deliveryGoogleAddress: "九龍觀塘巧明街 6 號",
      deliveryBuilding: "巧運大廈",
      deliveryFloor: "7",
      deliveryUnit: "A",
      recipientType: "personal" as const,
      recipientCompanyName: "",
      recipientName: "Second Recipient",
      recipientPhone: "62345678",
      deliveryPerson: "Driver B",
      failedDeliveryAction: "none",
      deliveryNote: "Call first",
      itemAllocations: [{ itemId: "line-1", itemName: "花束", quantity: 1 }],
    };
    const pickupSplit = {
      id: "destination-3",
      fulfillmentType: "pickup" as const,
      deliveryDate: "2026-07-20",
      deliveryTimeMode: "specified" as const,
      deliveryTime: "下午 5 時",
      deliveryRegion: "",
      deliveryDistrict: "",
      deliveryArea: "",
      deliveryDetail: "",
      deliveryAddress: "中西花店門市自取",
      deliveryGoogleAddress: "",
      deliveryBuilding: "",
      deliveryFloor: "",
      deliveryUnit: "",
      recipientType: "personal" as const,
      recipientCompanyName: "",
      recipientName: "Pickup Contact",
      recipientPhone: "63456789",
      deliveryPerson: "",
      failedDeliveryAction: "none",
      deliveryNote: "Bring receipt",
      itemAllocations: [{ itemId: "line-1", itemName: "花束", quantity: 1 }],
    };
    render(
      <OrderHistory
        orders={[orderFixture({ deliverySplits: [deliverySplit, pickupSplit] })]}
        open
        onClose={vi.fn()}
      />,
    );

    openOrderEditSection("修改收貨點與商品分配");
    const primaryDestination = screen.getByRole("region", { name: "收貨點 1" });
    const secondaryDestination = screen.getByRole("region", { name: "額外收貨點 2" });
    expect(
      primaryDestination.compareDocumentPosition(secondaryDestination)
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "額外收貨點 2" })).toBeVisible();
    expect(screen.getByRole("region", { name: "額外收貨點 3" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("額外收貨點 2 送貨地址 *"), {
      target: { value: "九龍觀塘鴻圖道新地址" },
    });
    fireEvent.change(screen.getByLabelText("額外收貨點 3 收貨人／聯絡人"), {
      target: { value: "Updated Pickup Contact" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => {
      expect(updateOdooOrderSection).toHaveBeenCalledWith(
        17,
        {
          section: "delivery",
          data: expect.objectContaining({
            deliverySplits: [
              expect.objectContaining({
                id: "destination-2",
                deliveryAddress: "九龍觀塘鴻圖道新地址",
                itemAllocations: [{ itemId: "line-1", itemName: "花束", quantity: 1 }],
              }),
              expect.objectContaining({
                id: "destination-3",
                fulfillmentType: "pickup",
                recipientName: "Updated Pickup Contact",
                itemAllocations: [{ itemId: "line-1", itemName: "花束", quantity: 1 }],
              }),
            ],
          }),
        },
      );
    });
  });

  it("sends explicit D1 and split occasion clears while retaining the split partner binding", async () => {
    updateOdooOrderSection.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    const deliverySplit = {
      id: "destination-2",
      fulfillmentType: "delivery" as const,
      deliveryDate: "2026-07-19",
      deliveryTimeMode: "specified" as const,
      deliveryTime: "下午 4 時前",
      deliveryRegion: "九龍",
      deliveryDistrict: "觀塘區",
      deliveryArea: "觀塘",
      deliveryDetail: "巧明街 6 號",
      deliveryAddress: "九龍觀塘巧明街 6 號",
      deliveryGoogleAddress: "九龍觀塘巧明街 6 號",
      deliveryBuilding: "",
      deliveryFloor: "",
      deliveryUnit: "",
      recipientType: "personal" as const,
      recipientCompanyName: "",
      recipientName: "Second Recipient",
      recipientPhone: "62345678",
      recipientOccasions: [{ type: "birthday" as const, date: "1985-11-12" }],
      recipientOccasionsVersion: "recipient-85-v4",
      recipientPartnerId: 85,
      deliveryPerson: "Driver B",
      failedDeliveryAction: "none",
      deliveryNote: "",
      itemAllocations: [{ itemId: "line-1", itemName: "花束", quantity: 1 }],
    };
    render(
      <OrderHistory
        orders={[orderFixture({
          recipientOccasions: [{ type: "birthday", date: "1990-01-02" }],
          recipientOccasionsVersion: "recipient-84-v3",
          recipientPartnerId: 84,
          deliverySplits: [deliverySplit],
        })]}
        open
        onClose={vi.fn()}
      />,
    );

    openOrderEditSection("修改收貨點與商品分配");
    fireEvent.click(screen.getByRole("button", {
      name: "移除主要收貨點收花人重要日子 1",
    }));
    fireEvent.click(screen.getByRole("button", {
      name: "移除額外收貨點 2 收花人重要日子 1",
    }));
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => {
      expect(updateOdooOrderSection).toHaveBeenCalledWith(
        17,
        {
          section: "delivery",
          data: expect.objectContaining({
            recipientPartnerId: 84,
            recipientOccasions: [],
            recipientOccasionsVersion: "recipient-84-v3",
            deliverySplits: [expect.objectContaining({
              id: "destination-2",
              recipientOccasions: [],
              recipientOccasionsVersion: "recipient-85-v4",
              recipientPartnerId: 85,
            })],
          }),
        },
      );
    });
  });

  it("omits unchanged legacy occasion fields during unrelated primary and split edits", async () => {
    updateOdooOrderSection.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    const deliverySplit = {
      id: "destination-2",
      fulfillmentType: "delivery" as const,
      deliveryDate: "2026-07-19",
      deliveryTimeMode: "specified" as const,
      deliveryTime: "下午 4 時前",
      deliveryRegion: "九龍",
      deliveryDistrict: "觀塘區",
      deliveryArea: "觀塘",
      deliveryDetail: "巧明街 6 號",
      deliveryAddress: "九龍觀塘巧明街 6 號",
      deliveryGoogleAddress: "九龍觀塘巧明街 6 號",
      deliveryBuilding: "",
      deliveryFloor: "",
      deliveryUnit: "",
      recipientType: "personal" as const,
      recipientCompanyName: "",
      recipientName: "Second Recipient",
      recipientPhone: "62345678",
      recipientBirthday: "1985-11-12",
      recipientPartnerId: 85,
      deliveryPerson: "Driver B",
      failedDeliveryAction: "none",
      deliveryNote: "",
      itemAllocations: [{ itemId: "line-1", itemName: "花束", quantity: 1 }],
    };
    render(
      <OrderHistory
        orders={[orderFixture({
          senderName: "Original Sender",
          recipientBirthday: "1990-01-02",
          recipientPartnerId: 84,
          deliverySplits: [deliverySplit],
        })]}
        open
        onClose={vi.fn()}
      />,
    );

    openOrderEditSection("修改收貨點與商品分配");
    fireEvent.change(screen.getByLabelText("額外收貨點 2 送貨地址 *"), {
      target: { value: "九龍觀塘巧明街 8 號" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => expect(updateOdooOrderSection).toHaveBeenCalledTimes(1));
    const update = updateOdooOrderSection.mock.calls[0][1];
    const payload = update.data;
    expect(update.section).toBe("delivery");
    expect(payload).toHaveProperty("recipientPartnerId", 84);
    expect(payload).not.toHaveProperty("recipientOccasions");
    expect(payload).not.toHaveProperty("recipientOccasionsVersion");
    expect(payload).not.toHaveProperty("recipientBirthday");
    expect(payload.deliverySplits[0]).toHaveProperty("recipientPartnerId", 85);
    expect(payload.deliverySplits[0]).not.toHaveProperty("recipientOccasions");
    expect(payload.deliverySplits[0]).not.toHaveProperty("recipientOccasionsVersion");
    expect(payload.deliverySplits[0]).not.toHaveProperty("recipientBirthday");
  });

  it("blocks occasion changes for a bound recipient when no current version is available", async () => {
    render(
      <OrderHistory
        orders={[orderFixture({
          recipientPartnerId: 84,
          recipientOccasions: [{ type: "birthday", date: "1990-01-02" }],
        })]}
        open
        onClose={vi.fn()}
      />,
    );

    openOrderEditSection("修改收貨點與商品分配");
    fireEvent.click(screen.getByRole("combobox", { name: "主要收貨點收花人重要日子 1 類型" }));
    fireEvent.click(screen.getByRole("option", { name: "週年" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("未有最新版本");
    expect(screen.getByRole("alert")).toHaveTextContent("重新選擇收花人");
    expect(updateOdooOrderSection).not.toHaveBeenCalled();
  });

  it("blocks occasion changes after recipient identity detaches the current version", async () => {
    render(
      <OrderHistory
        orders={[orderFixture({
          recipientPartnerId: 84,
          recipientOccasions: [{ type: "birthday", date: "1990-01-02" }],
          recipientOccasionsVersion: "recipient-84-v3",
        })]}
        open
        onClose={vi.fn()}
      />,
    );

    openOrderEditSection("修改收貨點與商品分配");
    fireEvent.change(screen.getByLabelText("收貨人／聯絡人姓名 *"), {
      target: { value: "Changed Recipient" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "主要收貨點收花人重要日子 1 類型" }));
    fireEvent.click(screen.getByRole("option", { name: "週年" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("未有最新版本");
    expect(updateOdooOrderSection).not.toHaveBeenCalled();
  });

  it("clears only the primary recipient binding when its identity is edited", async () => {
    updateOdooOrderSection.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    render(
      <OrderHistory
        orders={[orderFixture({
          recipientPartnerId: 84,
          recipientOccasions: [{ type: "birthday", date: "1990-01-02" }],
          recipientOccasionsVersion: "recipient-84-v3",
          deliverySplits: [{
            id: "destination-2",
            fulfillmentType: "delivery",
            deliveryDate: "2026-07-19",
            deliveryTimeMode: "specified",
            deliveryTime: "下午 4 時前",
            deliveryRegion: "九龍",
            deliveryDistrict: "觀塘區",
            deliveryArea: "觀塘",
            deliveryDetail: "巧明街 6 號",
            deliveryAddress: "九龍觀塘巧明街 6 號",
            deliveryGoogleAddress: "九龍觀塘巧明街 6 號",
            deliveryBuilding: "",
            deliveryFloor: "",
            deliveryUnit: "",
            recipientType: "personal",
            recipientCompanyName: "",
            recipientName: "Second Recipient",
            recipientPhone: "62345678",
            recipientOccasions: [{ type: "birthday", date: "1985-11-12" }],
            recipientOccasionsVersion: "recipient-85-v4",
            recipientPartnerId: 85,
            deliveryPerson: "Driver B",
            failedDeliveryAction: "none",
            deliveryNote: "",
            itemAllocations: [{ itemId: "line-1", itemName: "花束", quantity: 1 }],
          }],
        })]}
        open
        onClose={vi.fn()}
      />,
    );

    openOrderEditSection("修改收貨點與商品分配");
    fireEvent.change(screen.getByLabelText("收貨人／聯絡人姓名 *"), {
      target: { value: "Changed Primary Recipient" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => {
      const update = updateOdooOrderSection.mock.calls[0]?.[1];
      const payload = update?.data;
      expect(update?.section).toBe("delivery");
      expect(payload).toBeDefined();
      if (!payload) return;
      expect(payload).not.toHaveProperty("recipientPartnerId");
      expect(payload).not.toHaveProperty("recipientOccasionsVersion");
      expect(payload.deliverySplits).toEqual([
        expect.objectContaining({
          recipientPartnerId: 85,
        }),
      ]);
      expect(payload.deliverySplits[0]).not.toHaveProperty("recipientOccasions");
      expect(payload.deliverySplits[0]).not.toHaveProperty("recipientOccasionsVersion");
    });
  });

  it("allows an existing order to select a different standard delivery slot", async () => {
    updateOdooOrderSection.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    render(<OrderHistory orders={[orderFixture()]} open onClose={vi.fn()} />);

    openOrderEditSection("修改收貨點與商品分配");
    await waitFor(() => expect(getDeliverySlots).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("combobox", { name: "標準送貨時段 *" }));
    fireEvent.click(await screen.findByRole("option", { name: "下午 13:00-18:00" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => {
      expect(updateOdooOrderSection).toHaveBeenCalledWith(
        17,
        {
          section: "delivery",
          data: expect.objectContaining({
            deliveryTimeMode: "slot",
            deliverySlotId: 12,
            deliveryTime: "下午 13:00-18:00",
          }),
        },
      );
    });
  });

  it("allows switching an existing standard slot to a specified delivery time", async () => {
    updateOdooOrderSection.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    render(<OrderHistory orders={[orderFixture()]} open onClose={vi.fn()} />);

    openOrderEditSection("修改收貨點與商品分配");
    fireEvent.click(screen.getByRole("combobox", { name: "送貨時間模式 *" }));
    fireEvent.click(screen.getByRole("option", { name: "指定時間" }));
    fireEvent.click(screen.getByRole("combobox", { name: "指定送貨時間 * 小時" }));
    fireEvent.click(screen.getByRole("option", { name: "下午 03 時" }));
    fireEvent.click(screen.getByRole("combobox", { name: "指定送貨時間 * 分鐘" }));
    fireEvent.click(screen.getByRole("option", { name: "15 分" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => {
      expect(updateOdooOrderSection).toHaveBeenCalledWith(
        17,
        {
          section: "delivery",
          data: expect.objectContaining({
            deliveryTimeMode: "specified",
            deliverySlotId: undefined,
            deliveryTime: "15:15",
          }),
        },
      );
    });
  });

  it("records a later payment against an unpaid Odoo order", async () => {
    recordOdooOrderPayment.mockResolvedValue({
      id: 17,
      invoice: { id: 21, name: "INV/2026/00021" },
      payment: { id: 31, name: "PBNK1/2026/00031" },
      amountReceivedMinor: 68000,
      amountResidualMinor: 0,
      paymentStatus: "paid",
      writeDate: "2026-08-03 10:02:00",
      idempotentReplay: false,
    });
    const onOrderUpdated = vi.fn();
    render(<OrderHistory orders={[orderFixture({
      paymentStatus: "unpaid",
      depositAmount: 0,
      balanceAmount: 680,
    })]} open onClose={vi.fn()} onOrderUpdated={onOrderUpdated} />);

    openOrderEditSection("補記付款");
    await waitFor(() => expect(getAccountingPaymentOptions).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("付款參考編號 *"), {
      target: { value: "FPS-680" },
    });
    fireEvent.click(screen.getByRole("button", { name: "記錄付款到 Odoo" }));

    await waitFor(() => {
      expect(recordOdooOrderPayment).toHaveBeenCalledWith(17, expect.objectContaining({
        amount: 680,
        paymentMethod: "cash_other",
        paymentReference: "FPS-680",
        paymentIdempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }));
    });
    expect(onOrderUpdated).toHaveBeenCalledTimes(1);
  });

  it("hides payment actions when an unpaid label has no outstanding balance", () => {
    render(<OrderHistory orders={[orderFixture({
      paymentStatus: "unpaid",
      balanceAmount: 0,
    })]} open onClose={vi.fn()} />);

    openOrderDetails();
    expect(screen.queryByRole("button", { name: "付款與會計參考操作選單" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "編輯訂單資料" }), { key: "Enter" });
    expect(screen.queryByRole("menuitem", { name: "補記付款" })).not.toBeInTheDocument();
  });

  it("marks specified delivery time explicitly", () => {
    render(<OrderHistory orders={[orderFixture({
      deliveryTimeMode: "specified",
      deliveryTime: "上午 10 時前",
    })]} open onClose={vi.fn()} />);

    expect(screen.getByText("送貨：2026-07-18")).toBeVisible();
    expect(screen.getByText("指定時間：上午 10 時前")).toBeVisible();
  });

  it("does not present a failed first Odoo load as an empty day", () => {
    render(
      <OrderHistory
        orders={[]}
        open
        onClose={vi.fn()}
        loaded={false}
        error="Backend unavailable"
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("未能確認 Odoo 訂單記錄，請重試")).toBeVisible();
    expect(screen.queryByText("暫無訂單")).not.toBeInTheDocument();
  });

  it("shows business snapshots plus per-line packing and remarks in order details", () => {
    render(<OrderHistory orders={[orderFixture({
      customerEmail: "accounts@example.com",
      billingAddress: "香港中環花園道 1 號",
      customerGroup: "Corporate",
      senderDoNumber: "SDO-100",
      recipientDoNumber: "RDO-200",
      sourceReference: "PO-300",
      department: "Marketing",
      terms: "Net 30",
      items: [{
        id: "line-1",
        name: "花束",
        price: 680,
        quantity: 1,
        packing: "禮盒",
        remarks: "白色絲帶",
      }],
    })]} open onClose={vi.fn()} />);

    openOrderDetails();
    expect(screen.getByText("包裝：禮盒 · 備註：白色絲帶")).toBeVisible();
    fireEvent.click(screen.getByText("業務詳情"));
    expect(screen.getByText("accounts@example.com")).toBeVisible();
    expect(screen.getByText("香港中環花園道 1 號")).toBeVisible();
    expect(screen.getByText("PO-300")).toBeVisible();
    expect(screen.getByText("Net 30")).toBeVisible();
  });

  it("keeps accepted orders visible without exposing backend sync details", () => {
    const pending = orderFixture({
      id: "pending-order",
      source: "operational",
      syncState: "pending_odoo",
      operationalOrderId: "pending-operational-id",
      operationalRetryEligible: true,
      operationalAttemptCount: 2,
      operationalLastError: "odoo_unavailable",
    });
    const review = orderFixture({
      id: "review-order",
      source: "operational",
      syncState: "needs_review",
      operationalOrderId: "review-operational-id",
      operationalRetryEligible: false,
      operationalReviewError: "customer_conflict",
    });

    render(
      <OrderHistory
        orders={[pending, review]}
        open
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("訂單記錄 (2)")).toBeVisible();
    expect(screen.queryByText(/Odoo 同步/)).not.toBeInTheDocument();
    expect(screen.queryByText(/已安全保存/)).not.toBeInTheDocument();
    expect(screen.queryByText(/已嘗試/)).not.toBeInTheDocument();
    expect(screen.queryByText(/odoo_unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/customer_conflict/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /重試 Odoo 同步/ })).not.toBeInTheDocument();
    expect(screen.queryByText("已同步")).not.toBeInTheDocument();
    expect(screen.queryByText("待傳送")).not.toBeInTheDocument();
    expect(screen.getAllByText("同步延誤").length).toBeGreaterThan(0);
    expect(screen.getByText("需主管處理")).toBeVisible();
  });

  it("filters payment status without exposing a routine sync-status filter", () => {
    const onSearchQueryChange = vi.fn();
    const orders = [
      orderFixture({ id: "paid", odooOrderName: "S-PAID", paymentStatus: "paid" }),
      orderFixture({
        id: "pending",
        odooOrderName: undefined,
        source: "operational",
        syncState: "pending_odoo",
        paymentStatus: "unpaid",
      }),
    ];
    render(
      <OrderHistory
        orders={orders}
        open
        onClose={vi.fn()}
        searchQuery="Wong"
        searchPhase="success"
        onSearchQueryChange={onSearchQueryChange}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "未付款 1" }));
    expect(screen.queryByRole("button", { name: "查看訂單 S-PAID" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看訂單 pending" })).toBeInTheDocument();
    expect(screen.getByText("訂單記錄 (1/2)")).toBeVisible();
    expect(screen.queryByLabelText("同步狀態篩選")).not.toBeInTheDocument();
    expect(screen.queryByText("全部同步狀態")).not.toBeInTheDocument();
    expect(onSearchQueryChange).not.toHaveBeenCalled();
  });

  it("opens a full-page detail and provides a 44px back control", () => {
    render(<OrderHistory orders={[orderFixture()]} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "查看訂單 S00017" }));
    const back = screen.getByRole("button", { name: "返回訂單列表" });
    expect(back).toHaveClass("min-h-11", "touch-manipulation");
    fireEvent.click(back);
    expect(screen.getByRole("main", { name: "訂單列表" })).toHaveClass("flex");
  });

  it("shows every destination allocation, recipient birthday, card, note, and accounting reference", () => {
    render(<OrderHistory orders={[orderFixture({
      recipientBirthday: "1990-01-02",
      giftCardEnabled: true,
      giftCardMessage: "生日快樂",
      odooInvoiceId: 21,
      odooInvoiceName: "INV/2026/00021",
      odooPaymentId: 31,
      odooPaymentName: "PBNK1/2026/00031",
      items: [{ id: "line-1", name: "花束", price: 680, quantity: 2 }],
      deliverySplits: [{
        id: "destination-2",
        fulfillmentType: "delivery",
        deliveryDate: "2026-07-19",
        deliveryTimeMode: "specified",
        deliveryTime: "下午 4 時前",
        deliveryRegion: "九龍",
        deliveryDistrict: "觀塘區",
        deliveryArea: "觀塘",
        deliveryDetail: "巧明街 6 號",
        deliveryAddress: "九龍觀塘巧明街 6 號",
        deliveryGoogleAddress: "",
        deliveryBuilding: "巧運大廈",
        deliveryFloor: "7",
        deliveryUnit: "A",
        recipientType: "personal",
        recipientCompanyName: "",
        recipientName: "Second Recipient",
        recipientPhone: "62345678",
        recipientBirthday: "1985-11-12",
        deliveryPerson: "Driver B",
        failedDeliveryAction: "return_store",
        deliveryNote: "Call first",
        giftCardEnabled: true,
        giftCardMessage: "Get well soon",
        itemAllocations: [{ itemId: "line-1", itemName: "花束", quantity: 1 }],
      }],
    })]} open onClose={vi.fn()} />);

    openOrderDetails();
    const primary = screen.getByRole("article", { name: "主要收貨點 1" });
    expect(within(primary).getByText(/收件人生日：1990-01-02/)).toBeVisible();
    expect(within(primary).getByText("生日快樂")).toBeVisible();
    expect(within(primary).getByText("× 1")).toBeVisible();
    const split = screen.getByRole("article", { name: "額外收貨點 2" });
    expect(within(split).getByText("九龍觀塘巧明街 6 號")).toBeVisible();
    expect(within(split).queryByText("地址補充")).not.toBeInTheDocument();
    expect(within(split).queryByText(/九龍 · 觀塘區 · 觀塘/)).not.toBeInTheDocument();
    expect(within(split).getByText(/收件人生日：1985-11-12/)).toBeVisible();
    expect(within(split).getByText("Call first")).toBeVisible();
    expect(within(split).getByText("Get well soon")).toBeVisible();
    expect(screen.getAllByText("INV/2026/00021").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PBNK1/2026/00031").length).toBeGreaterThan(0);
  });

  it("loads edit history only for the selected synced Odoo order and aborts stale requests", async () => {
    const requests: Array<{ orderId: number; signal: AbortSignal }> = [];
    getOdooOrderEditHistory.mockImplementation((orderId: number, signal: AbortSignal) => {
      requests.push({ orderId, signal });
      return new Promise(() => {});
    });
    render(<OrderHistory orders={[
      orderFixture({ id: "first", odooOrderId: 17, odooOrderName: "S00017" }),
      orderFixture({ id: "second", odooOrderId: 18, odooOrderName: "S00018" }),
      orderFixture({ id: "local", source: "local", syncState: "unsynced", odooOrderId: undefined, odooOrderName: undefined }),
    ]} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "查看訂單 S00017" }));
    await waitFor(() => expect(requests.map((request) => request.orderId)).toEqual([17]));
    fireEvent.click(screen.getByRole("button", { name: "返回訂單列表" }));
    fireEvent.click(screen.getByRole("button", { name: "查看訂單 S00018" }));
    await waitFor(() => expect(requests.map((request) => request.orderId)).toEqual([17, 18]));
    expect(requests[0].signal.aborted).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "返回訂單列表" }));
    fireEvent.click(screen.getByRole("button", { name: "查看訂單 local" }));
    await waitFor(() => expect(requests[1].signal.aborted).toBe(true));
    expect(getOdooOrderEditHistory).toHaveBeenCalledTimes(2);
    expect(screen.getByText("此訂單尚未有 Odoo 訂單記錄，因此暫時未能顯示修改記錄。")).toBeVisible();
  });

  it("shows independent history error, retry, timeline, and escaped values", async () => {
    getOdooOrderEditHistory
      .mockRejectedValueOnce(new Error("timeline unavailable"))
      .mockResolvedValueOnce({
        orderId: 17,
        truncated: true,
        entries: [{
          id: "edit-1",
          changedAt: "2026-08-03T10:01:00+08:00",
          operatorEmployeeId: 95,
          operatorName: "Elma",
          changes: [{
            field: null,
            label: "送貨地址",
            oldValue: "<b>舊地址</b>",
            newValue: "<script>新地址</script>",
          }],
        }, {
          id: "payment-1",
          changedAt: "2026-08-03T10:05:00+08:00",
          operatorEmployeeId: 174,
          operatorName: "Testing",
          changes: [{
            field: "payment_status",
            label: "付款狀態",
            oldValue: "unpaid",
            newValue: "paid",
          }],
        }],
      });
    render(<OrderHistory orders={[orderFixture()]} open onClose={vi.fn()} />);

    openOrderDetails();
    expect(await screen.findByText("timeline unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "重試修改記錄" }));
    expect(await screen.findByText("Elma")).toBeVisible();
    const auditSection = screen.getByRole("region", { name: "修改記錄" });
    expect(screen.getByText("修改記錄較多；目前只顯示最新 100 筆。")).toBeVisible();
    expect(screen.getByText("<b>舊地址</b>")).toBeVisible();
    expect(screen.getByText("<script>新地址</script>")).toBeVisible();
    expect(within(auditSection).getByText("Testing")).toBeVisible();
    expect(within(auditSection).getByText("付款狀態")).toBeVisible();
    expect(screen.getByLabelText("2 次修改")).toBeVisible();
    expect(screen.getByText("修改 2 次")).toBeVisible();

    const identitySection = screen.getByRole("region", { name: "訂單身份與時間" });
    const customerSection = screen.getByRole("region", { name: "客戶與送花人" });
    expect(identitySection.compareDocumentPosition(auditSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(auditSection.compareDocumentPosition(customerSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
  });

  it("refreshes edit history after a successful order edit", async () => {
    getOdooOrderEditHistory.mockResolvedValue({ orderId: 17, entries: [], truncated: false });
    updateOdooOrderSection.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    render(<OrderHistory orders={[orderFixture()]} open onClose={vi.fn()} />);

    openOrderDetails();
    await waitFor(() => expect(getOdooOrderEditHistory).toHaveBeenCalledTimes(1));
    openOrderEditSection("修改收貨點與商品分配");
    fireEvent.change(screen.getByLabelText("送貨地址 *"), { target: { value: "新地址" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => expect(getOdooOrderEditHistory).toHaveBeenCalledTimes(2));
  });

  it("allows an eligible manager to retry an operational order without exposing raw sync errors", async () => {
    const onRetryOperationalOrder = vi.fn().mockResolvedValue(undefined);
    render(<OrderHistory
      orders={[orderFixture({
        source: "operational",
        syncState: "pending_odoo",
        operationalOrderId: "operational-17",
        operationalRetryEligible: true,
        operationalLastError: "sensitive_backend_trace",
      })]}
      open
      onClose={vi.fn()}
      canRetryOperationalOrders
      onRetryOperationalOrder={onRetryOperationalOrder}
    />);

    openOrderDetails();
    fireEvent.click(screen.getByRole("button", { name: "重試訂單 S00017 Odoo 同步" }));
    await waitFor(() => expect(onRetryOperationalOrder).toHaveBeenCalledWith("operational-17"));
    expect(screen.queryByText("sensitive_backend_trace")).not.toBeInTheDocument();
  });
});
