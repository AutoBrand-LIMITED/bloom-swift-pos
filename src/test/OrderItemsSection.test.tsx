import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrderItemsSection from "@/components/pos/OrderItemsSection";
import { getDeliveryFees, reorderDeliveryFees, updateDeliveryFee } from "@/lib/odoo-api";
import type { OrderItem } from "@/types/order";

vi.mock("@/lib/odoo-api", () => ({
  hasOdooBackend: false,
  getOdooProducts: vi.fn().mockResolvedValue([]),
  getOdooProductCategories: vi.fn().mockResolvedValue([]),
  getDeliveryFees: vi.fn().mockResolvedValue([]),
  createDeliveryFee: vi.fn(),
  updateDeliveryFee: vi.fn(),
  reorderDeliveryFees: vi.fn(),
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

  it("keeps the product catalog compact without an expand or collapse control", () => {
    renderItems([]);

    expect(screen.queryByRole("button", { name: "展開" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "收合" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "調整商品目錄高度" })).not.toBeInTheDocument();
  });

  it("opens the large product picker for ordinary staff", () => {
    renderItems([]);

    fireEvent.click(screen.getByRole("button", { name: "Full View" }));

    expect(screen.getByRole("dialog", { name: "商品 Full View" })).toBeVisible();
    expect(screen.getByLabelText("Full View 搜尋商品")).toBeVisible();
    expect(screen.queryByRole("button", { name: "管理" })).not.toBeInTheDocument();
  });

  it("shows product management only to managers", () => {
    const props = {
      items: [] as OrderItem[],
      onItemsChange: vi.fn(),
      deliveryFee: 0,
      urgentFee: 0,
      onDeliveryFeeChange: vi.fn(),
      onUrgentFeeChange: vi.fn(),
      onCustomOrderSummary: vi.fn(),
      budget: 0,
      onBudgetChange: vi.fn(),
      subtotal: 0,
    };
    const { rerender } = render(<OrderItemsSection {...props} />);

    expect(screen.queryByRole("button", { name: "管理" })).not.toBeInTheDocument();

    rerender(<OrderItemsSection {...props} canManageProducts />);
    expect(screen.getByRole("button", { name: "管理" })).toBeVisible();
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

  it("offers the five seeded delivery zones by option ID and does not allow free amount entry", () => {
    const onDeliveryFeeChange = vi.fn();

    render(
      <OrderItemsSection
        items={[]}
        onItemsChange={vi.fn()}
        deliveryFee={0}
        urgentFee={0}
        onDeliveryFeeChange={onDeliveryFeeChange}
        onUrgentFeeChange={vi.fn()}
        onCustomOrderSummary={vi.fn()}
        budget={0}
        onBudgetChange={vi.fn()}
        subtotal={0}
      />,
    );

    expect(screen.queryByRole("spinbutton", { name: "送貨費" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "送貨費" }));

    expect(screen.getAllByRole("option")).toHaveLength(5);
    expect(screen.getByRole("option", { name: "香港島第 1 區 — 80" })).toBeVisible();
    expect(screen.getByRole("option", { name: "香港島第 2 區 — 100" })).toBeVisible();
    expect(screen.getByRole("option", { name: "香港島第 3 區 — 120" })).toBeVisible();
    expect(screen.getByRole("option", { name: "九龍 — 130" })).toBeVisible();
    expect(screen.getByRole("option", { name: "新界 — 250" })).toBeVisible();

    fireEvent.click(screen.getByRole("option", { name: "香港島第 3 區 — 120" }));
    expect(onDeliveryFeeChange).toHaveBeenCalledWith(120);
  });

  it("shows delivery-fee management only to managers", async () => {
    const { rerender } = render(
      <OrderItemsSection items={[]} onItemsChange={vi.fn()} deliveryFee={0} urgentFee={0}
        onDeliveryFeeChange={vi.fn()} onUrgentFeeChange={vi.fn()} onCustomOrderSummary={vi.fn()}
        budget={0} onBudgetChange={vi.fn()} subtotal={0} />,
    );
    expect(screen.queryByRole("button", { name: "管理送貨費" })).not.toBeInTheDocument();
    rerender(
      <OrderItemsSection items={[]} onItemsChange={vi.fn()} deliveryFee={0} urgentFee={0}
        canManageDeliveryFees onDeliveryFeeChange={vi.fn()} onUrgentFeeChange={vi.fn()}
        onCustomOrderSummary={vi.fn()} budget={0} onBudgetChange={vi.fn()} subtotal={0} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "管理送貨費" }));
    expect(screen.getByRole("dialog", { name: "送貨費設定" })).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("requires an explicit save before archive or reorder so edits are not lost", async () => {
    const rows = [
      { id: 1, label: "港島", amount: 80, sequence: 10, active: true },
      { id: 2, label: "九龍", amount: 130, sequence: 20, active: true },
    ];
    vi.mocked(getDeliveryFees).mockResolvedValue(rows);
    vi.mocked(updateDeliveryFee)
      .mockResolvedValueOnce({ ...rows[0], amount: 90 })
      .mockResolvedValueOnce({ ...rows[1], label: "九龍新" })
      .mockResolvedValueOnce({ ...rows[0], amount: 90, active: false });
    vi.mocked(reorderDeliveryFees).mockResolvedValue();
    render(<OrderItemsSection items={[]} onItemsChange={vi.fn()} deliveryFee={0} urgentFee={0}
      canManageDeliveryFees onDeliveryFeeChange={vi.fn()} onUrgentFeeChange={vi.fn()}
      onCustomOrderSummary={vi.fn()} budget={0} onBudgetChange={vi.fn()} subtotal={0} />);
    fireEvent.click(screen.getByRole("button", { name: "管理送貨費" }));
    await screen.findByLabelText("港島金額");
    fireEvent.change(screen.getByLabelText("港島金額"), { target: { value: "0" } });
    expect(screen.getByRole("button", { name: "儲存 港島" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("港島金額"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("九龍名稱"), { target: { value: "九龍新" } });
    expect(screen.getAllByRole("button", { name: "停用" })[0]).toBeDisabled();
    expect(screen.getAllByLabelText("向下移")[0]).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "儲存 港島" }));
    await waitFor(() => expect(updateDeliveryFee).toHaveBeenCalledWith(1, { label: "港島", amount: 90 }));
    expect(screen.getByLabelText("九龍名稱")).toHaveValue("九龍新");
    fireEvent.click(screen.getByRole("button", { name: "儲存 九龍" }));
    await waitFor(() => expect(updateDeliveryFee).toHaveBeenCalledWith(2, { label: "九龍新", amount: 130 }));
    expect(reorderDeliveryFees).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "停用" })[0]);
    await waitFor(() => expect(updateDeliveryFee).toHaveBeenCalledWith(1, { active: false }));
  });
});
