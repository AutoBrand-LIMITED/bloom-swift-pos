import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrderSummaryPanel from "@/components/pos/OrderSummaryPanel";

const baseProps = {
  customerName: "Jay Ng",
  phone: "67610707",
  recipientName: "May Chan",
  recipientPhone: "61234567",
  deliveryDate: "2026-08-03",
  deliveryTime: "下午 13:00–18:00",
  items: [
    {
      id: "line-1",
      name: "Rose Bouquet",
      price: 500,
      quantity: 2,
      discountPercent: 10,
    },
  ],
  deliveryFee: 80,
  urgentFee: 20,
  finalPrice: 1_000,
  paymentStatus: "deposit" as const,
  completedCount: 3,
  requiredSectionCount: 4,
  isSubmitting: false,
};

describe("OrderSummaryPanel", () => {
  it("shows the live order, delivery and completion summary", () => {
    render(
      <OrderSummaryPanel
        {...baseProps}
        onSubmit={() => undefined}
        onNavigate={() => undefined}
      />,
    );

    expect(screen.getByRole("complementary", { name: "訂單摘要" })).toBeVisible();
    expect(screen.getByText("已完成 3 / 4 個必填步驟")).toBeVisible();
    expect(screen.getByText("Rose Bouquet")).toBeVisible();
    expect(screen.getByText("$900")).toBeVisible();
    expect(screen.getByText("May Chan")).toBeVisible();
    expect(screen.getByText("已付訂金")).toBeVisible();
    expect(screen.getByText("$1,000")).toBeVisible();
  });

  it("links back to editable sections and submits from the desktop panel", () => {
    const onNavigate = vi.fn();
    const onSubmit = vi.fn();
    render(
      <OrderSummaryPanel
        {...baseProps}
        onSubmit={onSubmit}
        onNavigate={onNavigate}
      />,
    );

    const editButtons = screen.getAllByRole("button", { name: "修改" });
    fireEvent.click(editButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "確認訂單" }));

    expect(onNavigate).toHaveBeenCalledWith("items");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
