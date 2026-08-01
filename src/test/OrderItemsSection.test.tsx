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
  it("keeps packing and remarks editable on each order line", () => {
    const items: OrderItem[] = [{
      id: "line-1",
      name: "花束",
      price: 680,
      quantity: 1,
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

    fireEvent.change(screen.getByLabelText("花束 包裝"), { target: { value: "禮盒" } });
    expect(onItemsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "line-1", packing: "禮盒" }),
    ]);

    fireEvent.change(screen.getByLabelText("花束 項目備註"), { target: { value: "白色絲帶" } });
    expect(onItemsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "line-1", remarks: "白色絲帶" }),
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
});
