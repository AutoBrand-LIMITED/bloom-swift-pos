import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OrderHistory from "@/components/pos/OrderHistory";
import type { OrderRecordView } from "@/lib/order-records";

const {
  getAccountingPaymentOptions,
  getDeliverySlots,
  recordOdooOrderPayment,
  updateOdooOrderOperationalDetails,
} = vi.hoisted(() => ({
  getAccountingPaymentOptions: vi.fn(),
  getDeliverySlots: vi.fn(),
  recordOdooOrderPayment: vi.fn(),
  updateOdooOrderOperationalDetails: vi.fn(),
}));

vi.mock("@/lib/odoo-api", () => ({
  getAccountingPaymentOptions,
  getDeliverySlots,
  recordOdooOrderPayment,
  updateOdooOrderOperationalDetails,
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

describe("OrderHistory delivery summary", () => {
  beforeEach(() => {
    getDeliverySlots.mockReset();
    getDeliverySlots.mockResolvedValue([
      { id: 11, displayLabel: "上午 09:00-13:00", startTime: "09:00", endTime: "13:00" },
      { id: 12, displayLabel: "下午 13:00-18:00", startTime: "13:00", endTime: "18:00" },
    ]);
    updateOdooOrderOperationalDetails.mockReset();
    getAccountingPaymentOptions.mockReset();
    getAccountingPaymentOptions.mockResolvedValue([
      { code: "cash_other", label: "現金／其他" },
      { code: "bank_in_fps", label: "轉數快" },
    ]);
    recordOdooOrderPayment.mockReset();
  });

  it("keeps a fixed drawer with an independently scrollable order list", () => {
    const orders = Array.from({ length: 20 }, (_, index) => orderFixture({
      id: `order-${index + 1}`,
      odooOrderName: `S${String(index + 1).padStart(5, "0")}`,
      customerName: `客人 ${index + 1}`,
    }));

    render(<OrderHistory orders={orders} open onClose={vi.fn()} />);

    expect(screen.getByText("訂單記錄 (20)")).toBeVisible();
    expect(screen.getByTestId("order-history-scroll-area")).toHaveClass("min-h-0", "flex-1");
    expect(screen.getByRole("group", { name: /訂單 S00020/ })).toBeInTheDocument();
  });

  it("offers cross-date order search for customer and recipient details", () => {
    const onSearchQueryChange = vi.fn();
    render(
      <OrderHistory
        orders={[]}
        open
        onClose={vi.fn()}
        searchQuery="accounts@example.com"
        onSearchQueryChange={onSearchQueryChange}
        searchPhase="success"
      />,
    );

    expect(screen.getByRole("textbox", { name: "搜尋訂單" })).toHaveValue("accounts@example.com");
    expect(screen.getByText("跨日期搜尋結果：0 筆")).toBeVisible();
    expect(screen.getByText("未找到符合資料的訂單")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "清除訂單搜尋" }));
    expect(onSearchQueryChange).toHaveBeenCalledWith("");
  });

  it("does not show a stale count or false zero while a remote search is unsettled", () => {
    const { rerender } = render(
      <OrderHistory
        orders={[]}
        open
        onClose={vi.fn()}
        searchQuery="Wong"
        onSearchQueryChange={vi.fn()}
        searchPhase="debouncing"
      />,
    );

    expect(screen.getByText("訂單記錄")).toBeVisible();
    expect(screen.getAllByText("等待搜尋當前資料...").length).toBeGreaterThan(0);
    expect(screen.queryByText("未找到符合資料的訂單")).not.toBeInTheDocument();
    expect(screen.queryByText(/跨日期搜尋結果/)).not.toBeInTheDocument();

    rerender(
      <OrderHistory
        orders={[]}
        open
        onClose={vi.fn()}
        searchQuery="Wong"
        onSearchQueryChange={vi.fn()}
        searchPhase="error"
        error="Backend unavailable"
      />,
    );
    expect(screen.getByText("搜尋未完成，請重試")).toBeVisible();
    expect(screen.queryByText("未找到符合資料的訂單")).not.toBeInTheDocument();
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

    const order = screen.getByRole("group", { name: /訂單 S00017/ });
    expect(within(order).getByText("送貨：2026-07-18 · 上午 09:00-13:00")).toBeVisible();
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

    const order = screen.getByRole("group", { name: /訂單 S00017/ });
    expect(within(order).getByText("自取：2026-07-18 · 上午 09:00-13:00")).toBeVisible();
    expect(within(order).queryByText("送貨：2026-07-18 · 上午 09:00-13:00")).not.toBeInTheDocument();

    fireEvent.click(within(order).getByText("業務詳情"));
    expect(within(order).getByText("自取地點")).toBeVisible();
    expect(within(order).getByText("中西花店門市自取")).toBeVisible();
    expect(within(order).queryByText("送貨地址")).not.toBeInTheDocument();
  });

  it("edits an existing Odoo order and refreshes the drawer", async () => {
    updateOdooOrderOperationalDetails.mockResolvedValue({
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

    fireEvent.click(screen.getByRole("button", { name: "編輯訂單資料" }));
    expect(screen.getByRole("dialog")).toHaveClass(
      "h-[92dvh]",
      "grid-rows-[auto_minmax(0,1fr)_auto]",
    );
    const editScrollArea = screen.getByTestId("order-edit-scroll-area");
    expect(editScrollArea).toHaveClass("h-full", "min-h-0");
    expect(
      editScrollArea.querySelector("[data-radix-scroll-area-viewport]"),
    ).toHaveStyle({ overflowY: "scroll" });
    fireEvent.change(screen.getByLabelText("送貨地址 *"), {
      target: { value: "觀塘新地址" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => {
      expect(updateOdooOrderOperationalDetails).toHaveBeenCalledWith(
        17,
        expect.objectContaining({
          deliveryAddress: "觀塘新地址",
          expectedWriteDate: "2026-08-03 10:00:00",
        }),
      );
    });
    expect(onOrderUpdated).toHaveBeenCalledTimes(1);
  });

  it("edits every existing split destination while preserving IDs and item allocations", async () => {
    updateOdooOrderOperationalDetails.mockResolvedValue({
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

    fireEvent.click(screen.getByRole("button", { name: "編輯訂單資料" }));
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
      expect(updateOdooOrderOperationalDetails).toHaveBeenCalledWith(
        17,
        expect.objectContaining({
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
      );
    });
  });

  it("allows an existing order to select a different standard delivery slot", async () => {
    updateOdooOrderOperationalDetails.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    render(<OrderHistory orders={[orderFixture()]} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "編輯訂單資料" }));
    await waitFor(() => expect(getDeliverySlots).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("combobox", { name: "標準送貨時段 *" }));
    fireEvent.click(await screen.findByRole("option", { name: "下午 13:00-18:00" }));
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => {
      expect(updateOdooOrderOperationalDetails).toHaveBeenCalledWith(
        17,
        expect.objectContaining({
          deliveryTimeMode: "slot",
          deliverySlotId: 12,
          deliveryTime: "下午 13:00-18:00",
        }),
      );
    });
  });

  it("allows switching an existing standard slot to a specified delivery time", async () => {
    updateOdooOrderOperationalDetails.mockResolvedValue({
      id: 17,
      writeDate: "2026-08-03 10:01:00",
    });
    render(<OrderHistory orders={[orderFixture()]} open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "編輯訂單資料" }));
    fireEvent.click(screen.getByRole("combobox", { name: "送貨時間模式 *" }));
    fireEvent.click(screen.getByRole("option", { name: "指定時間" }));
    fireEvent.change(screen.getByLabelText("指定送貨時間 *"), {
      target: { value: "下午 3 時前" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存到 Odoo" }));

    await waitFor(() => {
      expect(updateOdooOrderOperationalDetails).toHaveBeenCalledWith(
        17,
        expect.objectContaining({
          deliveryTimeMode: "specified",
          deliverySlotId: undefined,
          deliveryTime: "下午 3 時前",
        }),
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

    fireEvent.click(screen.getByRole("button", { name: "編輯訂單資料" }));
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

  it("marks specified delivery time explicitly", () => {
    render(<OrderHistory orders={[orderFixture({
      deliveryTimeMode: "specified",
      deliveryTime: "上午 10 時前",
    })]} open onClose={vi.fn()} />);

    expect(screen.getByText("送貨：2026-07-18 · 指定時間：上午 10 時前")).toBeVisible();
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

    expect(screen.getByText("包裝：禮盒 · 備註：白色絲帶")).toBeVisible();
    fireEvent.click(screen.getByText("業務詳情"));
    expect(screen.getByText("accounts@example.com")).toBeVisible();
    expect(screen.getByText("香港中環花園道 1 號")).toBeVisible();
    expect(screen.queryByText("PO-300")).not.toBeInTheDocument();
    expect(screen.queryByText("Net 30")).not.toBeInTheDocument();
  });

  it("shows same-day backlog counts and lets a manager retry only an eligible pending row", async () => {
    let finishRetry!: () => void;
    const onOperationalRetry = vi.fn(() => new Promise<void>((resolve) => {
      finishRetry = resolve;
    }));
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
        viewerRole="manager"
        onOperationalRetry={onOperationalRetry}
      />,
    );

    expect(screen.getByText("Odoo 同步待處理（2）")).toBeVisible();
    expect(screen.getByText("待同步 1 · 同步中 0 · 需核對 1")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "立即重試 Odoo 同步" })).toHaveLength(1);
    expect(screen.getByText(/customer_conflict/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "立即重試 Odoo 同步" }));
    expect(onOperationalRetry).toHaveBeenCalledWith("pending-operational-id");
    expect(await screen.findByRole("button", { name: "正在重試 Odoo 同步..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "正在重試 Odoo 同步..." })).toHaveClass(
      "min-h-11",
      "touch-manipulation",
    );

    await act(async () => finishRetry());
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "立即重試 Odoo 同步" })).toBeEnabled();
    });
  });

  it("never exposes retry to staff and shows a manager retry error", async () => {
    const pending = orderFixture({
      id: "pending-order",
      source: "operational",
      syncState: "pending_odoo",
      operationalOrderId: "pending-operational-id",
      operationalRetryEligible: true,
    });
    const { rerender } = render(
      <OrderHistory
        orders={[pending]}
        open
        onClose={vi.fn()}
        viewerRole="staff"
        onOperationalRetry={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "立即重試 Odoo 同步" })).not.toBeInTheDocument();

    rerender(
      <OrderHistory
        orders={[pending]}
        open
        onClose={vi.fn()}
        viewerRole="manager"
        onOperationalRetry={vi.fn().mockRejectedValue(new Error("retry_conflict"))}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "立即重試 Odoo 同步" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("重試失敗：retry_conflict");
  });

  it("warns when the current-day operational backlog is truncated", () => {
    render(
      <OrderHistory
        orders={[]}
        open
        onClose={vi.fn()}
        viewerRole="manager"
        operationalTruncated
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "待同步訂單超過畫面顯示上限",
    );
  });
});
