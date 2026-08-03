import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OrderHistory from "@/components/pos/OrderHistory";
import type { OrderRecordView } from "@/lib/order-records";
import type { Order } from "@/types/order";

const { getDeliverySlots, updateOdooOrderOperationalDetails } = vi.hoisted(() => ({
  getDeliverySlots: vi.fn(),
  updateOdooOrderOperationalDetails: vi.fn(),
}));

vi.mock("@/lib/odoo-api", () => ({
  getDeliverySlots,
  updateOdooOrderOperationalDetails,
}));

const orderFixture = (overrides: Partial<Order> = {}): OrderRecordView => ({
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
      />,
    );

    expect(screen.getByRole("textbox", { name: "搜尋訂單" })).toHaveValue("accounts@example.com");
    expect(screen.getByText("跨日期搜尋結果：0 筆")).toBeVisible();
    expect(screen.getByText("未找到符合資料的訂單")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "清除訂單搜尋" }));
    expect(onSearchQueryChange).toHaveBeenCalledWith("");
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
    expect(screen.getByText("PO-300")).toBeVisible();
    expect(screen.getByText("Net 30")).toBeVisible();
  });
});
