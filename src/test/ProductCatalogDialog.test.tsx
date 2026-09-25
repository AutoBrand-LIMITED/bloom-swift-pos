import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProductCatalogDialog from "@/components/pos/ProductCatalogDialog";
import type { OdooProduct } from "@/lib/odoo-api";
import type { OrderItem } from "@/types/order";

const products: OdooProduct[] = [
  {
    id: 1,
    name: "Rose Bouquet",
    price: 680,
    productCode: "RB001",
    imageUrl: "",
    categoryId: 7,
    categoryName: "花束 Bouquets",
    templateId: 11,
    barcode: null,
    availableInPos: true,
    fixedPrice: true,
    displaySequence: 10,
    availableFrom: null,
    availableUntil: null,
  },
];

const orderItems: OrderItem[] = [
  { id: "line-1", name: "Rose Bouquet", price: 680, quantity: 2, productCode: "RB001" },
  { id: "line-2", name: "Chocolate", price: 120, quantity: 1, productCode: "CHOCO" },
];

const renderDialog = (overrides: Partial<React.ComponentProps<typeof ProductCatalogDialog>> = {}) => {
  const props: React.ComponentProps<typeof ProductCatalogDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    products,
    totalCount: 161,
    categories: [{ id: 7, name: "花束 Bouquets", parent_id: null, sequence: 10 }],
    query: "",
    onQueryChange: vi.fn(),
    activeCategory: "all",
    onActiveCategoryChange: vi.fn(),
    onSelectProduct: vi.fn(),
    orderItems,
    onItemQuantityChange: vi.fn(),
    onRemoveItem: vi.fn(),
    loading: false,
    error: null,
    onRetry: vi.fn(),
    ...overrides,
  };
  return { ...render(<ProductCatalogDialog {...props} />), props };
};

describe("ProductCatalogDialog", () => {
  it("uses a large product picker and keeps management controls out", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "商品 Full View" });
    expect(dialog).toHaveClass("h-[92dvh]", "max-w-[1500px]");
    expect(screen.getByText("訂單已有 2 項")).toBeVisible();
    expect(screen.getByRole("complementary", { name: "已選商品" })).toBeVisible();
    expect(screen.getByText("$1,480")).toBeVisible();
    expect(screen.queryByRole("button", { name: "管理" })).not.toBeInTheDocument();
  });

  it("searches, changes category, and adds products without closing", () => {
    const { props } = renderDialog();

    fireEvent.change(screen.getByLabelText("Full View 搜尋商品"), {
      target: { value: "rose" },
    });
    expect(props.onQueryChange).toHaveBeenCalledWith("rose");

    fireEvent.click(screen.getByRole("button", { name: "花束 Bouquets" }));
    expect(props.onActiveCategoryChange).toHaveBeenCalledWith(7);

    fireEvent.click(screen.getByRole("button", { name: "加入商品 Rose Bouquet" }));
    expect(props.onSelectProduct).toHaveBeenCalledWith(products[0]);
    expect(screen.getByRole("dialog", { name: "商品 Full View" })).toBeVisible();
  });

  it("changes quantity and removes a selected order item", () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "增加 Rose Bouquet 數量" }));
    expect(props.onItemQuantityChange).toHaveBeenCalledWith("line-1", 3);

    fireEvent.change(screen.getByLabelText("Chocolate 數量"), { target: { value: "4" } });
    expect(props.onItemQuantityChange).toHaveBeenCalledWith("line-2", 4);

    fireEvent.click(screen.getByRole("button", { name: "刪除已選商品 Chocolate" }));
    expect(props.onRemoveItem).toHaveBeenCalledWith("line-2");
  });
});
