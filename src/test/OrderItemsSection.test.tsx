import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrderItemsSection from "@/components/pos/OrderItemsSection";
import type { OrderItem } from "@/types/order";

vi.mock("@/lib/odoo-api", () => ({
  hasOdooBackend: false,
  getOdooProducts: vi.fn().mockResolvedValue([]),
  getOdooProductCategories: vi.fn().mockResolvedValue([]),
}));

describe("OrderItemsSection legacy line snapshots", () => {
  const renderItems = (items: OrderItem[], onItemsChange = vi.fn()) => render(
    <OrderItemsSection
      items={items}
      onItemsChange={onItemsChange}
      deliveryFee={0}
      urgentFee={0}
      onDeliveryFeeChange={vi.fn()}
      onUrgentFeeChange={vi.fn()}
      onCustomOrderSummary={vi.fn()}
      budget={0}
      onBudgetChange={vi.fn()}
      subtotal={items.reduce((total, item) => total + item.price * item.quantity, 0)}
    />,
  );

  it("removes packing and keeps a free-text note on each order line", () => {
    const items: OrderItem[] = [{
      id: "line-1",
      name: "花束",
      price: 680,
      quantity: 1,
      packing: "舊有禮盒記錄",
    }];
    const onItemsChange = vi.fn();

    render(
      <OrderItemsSection
        items={items}
        onItemsChange={onItemsChange}
        deliveryFee={0}
        urgentFee={0}
        onDeliveryFeeChange={vi.fn()}
        onUrgentFeeChange={vi.fn()}
        onCustomOrderSummary={vi.fn()}
        budget={0}
        onBudgetChange={vi.fn()}
        subtotal={680}
      />,
    );

    expect(screen.queryByLabelText("花束 包裝")).not.toBeInTheDocument();

    const remarks = screen.getByLabelText("花束 項目備註");
    expect(remarks.tagName).toBe("TEXTAREA");
    fireEvent.change(remarks, { target: { value: "白色絲帶\n星期五前完成" } });
    expect(onItemsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: "line-1",
        packing: "舊有禮盒記錄",
        remarks: "白色絲帶\n星期五前完成",
      }),
    ]);
  });

  it("keeps the optional customer budget collapsed until staff opens it", () => {
    const onBudgetChange = vi.fn();

    render(
      <OrderItemsSection
        items={[]}
        onItemsChange={vi.fn()}
        deliveryFee={0}
        urgentFee={0}
        onDeliveryFeeChange={vi.fn()}
        onUrgentFeeChange={vi.fn()}
        onCustomOrderSummary={vi.fn()}
        budget={1000}
        onBudgetChange={onBudgetChange}
        subtotal={680}
      />,
    );

    const toggle = screen.getByRole("button", { name: /客人預算/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("預算金額")).not.toBeInTheDocument();
    expect(screen.getByText("$1,000")).toBeVisible();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("預算金額")).toHaveValue(1000);
    expect(screen.getByText("剩餘 $320")).toBeVisible();

    fireEvent.change(screen.getByLabelText("預算金額"), {
      target: { value: "1200" },
    });
    expect(onBudgetChange).toHaveBeenCalledWith(1200);
  });

  it("locks an existing product name and offers only five-percent discount steps", () => {
    renderItems([{ id: "line-1", name: "花束", price: 680, quantity: 1 }]);

    expect(screen.getByLabelText("花束 商品名稱（不可修改）")).toBeDisabled();
    fireEvent.click(screen.getByRole("combobox", { name: "花束 百分比折扣" }));
    expect(screen.getByRole("option", { name: "5%" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "0.5%" })).not.toBeInTheDocument();
  });

  it("switches to a whole-dollar fixed discount and clears the percentage", () => {
    const onItemsChange = vi.fn();
    renderItems([{
      id: "line-1",
      name: "花束",
      price: 680,
      quantity: 1,
      discountType: "percent",
      discountPercent: 10,
    }], onItemsChange);

    fireEvent.click(screen.getByRole("combobox", { name: "花束 折扣方式" }));
    fireEvent.click(screen.getByRole("option", { name: "固定金額" }));

    expect(onItemsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ discountType: "fixed", discountPercent: 0, discountAmount: 0 }),
    ]);
  });

  it("requires a reason for fixed-price changes but not floating-price changes", () => {
    renderItems([
      {
        id: "fixed-line",
        name: "Fixed bouquet",
        price: 780,
        quantity: 1,
        productId: 1,
        catalogPrice: 680,
        fixedPrice: true,
      },
      {
        id: "floating-line",
        name: "Daily bouquet",
        price: 780,
        quantity: 1,
        productId: 2,
        catalogPrice: 680,
        fixedPrice: false,
      },
    ]);

    expect(screen.getByLabelText("Fixed bouquet 改價原因")).toBeInTheDocument();
    expect(screen.queryByLabelText("Daily bouquet 改價原因")).not.toBeInTheDocument();
    expect(screen.getByText(/浮動價格，可直接改價/)).toBeVisible();
  });
});
