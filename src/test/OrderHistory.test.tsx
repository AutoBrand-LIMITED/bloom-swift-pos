import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrderHistory from "@/components/pos/OrderHistory";
import type { OrderRecordView } from "@/lib/order-records";
import type { Order } from "@/types/order";

const orderFixture = (overrides: Partial<Order> = {}): OrderRecordView => ({
  source: "odoo",
  syncState: "synced",
  id: "order-1",
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
  it("shows the delivery date and frozen slot snapshot", () => {
    render(<OrderHistory orders={[orderFixture({ deliveryTimeMode: "slot", deliverySlotId: 11 })]} open onClose={vi.fn()} />);

    const order = screen.getByRole("group", { name: /訂單 order-1/ });
    expect(within(order).getByText("送貨：2026-07-18 · 上午 09:00-13:00")).toBeVisible();
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
});
