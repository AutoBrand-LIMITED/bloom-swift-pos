import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProductManagementDialog from "@/components/pos/ProductManagementDialog";

const apiMocks = vi.hoisted(() => ({
  searchProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  reorderProducts: vi.fn(),
}));

vi.mock("@/lib/odoo-api", () => ({
  hasOdooBackend: true,
  searchManageableOdooProducts: apiMocks.searchProducts,
  createOdooProduct: apiMocks.createProduct,
  updateOdooProduct: apiMocks.updateProduct,
  reorderOdooProducts: apiMocks.reorderProducts,
}));

const testingProduct = {
  id: 4338,
  name: "testing",
  price: 1111,
  productCode: "123",
  categoryId: 1,
  categoryName: "花束 Bouquets",
  templateId: 4338,
  barcode: "1234",
  availableInPos: true,
  displaySequence: 100,
  availableFrom: "2026-02-01",
  availableUntil: "2026-02-28",
  imageUrl: "",
};

const chocolateProduct = {
  ...testingProduct,
  id: 4339,
  name: "Chocolate",
  price: 123,
  productCode: "CHOCO",
  templateId: 4339,
  barcode: "4321",
  displaySequence: 100,
};

const renderDialog = () => render(
  <ProductManagementDialog
    open
    onOpenChange={vi.fn()}
    categories={[{ id: 1, name: "花束 Bouquets", parent_id: null, sequence: 1 }]}
    onCatalogChanged={vi.fn()}
  />
);

describe("ProductManagementDialog", () => {
  beforeEach(() => {
    apiMocks.searchProducts.mockReset();
    apiMocks.createProduct.mockReset();
    apiMocks.updateProduct.mockReset();
    apiMocks.reorderProducts.mockReset();
    apiMocks.searchProducts.mockResolvedValue([testingProduct]);
    apiMocks.updateProduct.mockImplementation(async (id: number, payload: Record<string, unknown>) => ({
      ...(id === testingProduct.id ? testingProduct : chocolateProduct),
      ...payload,
      id,
    }));
    apiMocks.reorderProducts.mockResolvedValue({ updated: 2 });
  });

  it("keeps the management panel fixed and visible above the modal overlay", async () => {
    renderDialog();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("fixed");
    expect(dialog).not.toHaveClass("relative");
    await screen.findByText("testing");
  });

  it("keeps the default view compact and opens editing only from product settings", async () => {
    renderDialog();

    await screen.findByText("testing");
    expect(screen.queryByLabelText("商品名稱")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("POS 排序")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "商品設定 testing" }));

    expect(screen.getByLabelText("商品名稱")).toHaveValue("testing");
    expect(screen.queryByLabelText("POS 排序")).not.toBeInTheDocument();
  });

  it("keeps a new-product form blank when the product list finishes loading", async () => {
    renderDialog();

    await screen.findByText("testing");
    fireEvent.click(screen.getByRole("button", { name: "新增商品" }));
    const nameInput = screen.getByLabelText("商品名稱");
    expect(nameInput).toHaveValue("");

    fireEvent.change(nameInput, { target: { value: "Browser UX Probe" } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(nameInput).toHaveValue("Browser UX Probe");
    expect(screen.getByLabelText("Product Code")).toHaveValue("");
    expect(screen.getByLabelText("售價 ($)")).toHaveValue(null);
    expect(screen.getByLabelText("Barcode")).toHaveValue("");
    expect(screen.getByLabelText("開始顯示日期")).toHaveValue("");
    expect(screen.getByLabelText("結束顯示日期")).toHaveValue("");
    expect(apiMocks.searchProducts).toHaveBeenCalledTimes(1);
  });

  it("filters products by category before sorting", async () => {
    renderDialog();

    await screen.findByText("testing");
    fireEvent.click(screen.getByRole("button", { name: "花束 Bouquets" }));

    await waitFor(() => expect(apiMocks.searchProducts).toHaveBeenLastCalledWith(
      "",
      undefined,
      1,
    ));
  });

  it("supports keyboard reordering and persists the category order in one request", async () => {
    apiMocks.searchProducts.mockResolvedValue([testingProduct, chocolateProduct]);
    renderDialog();

    await screen.findByText("Chocolate");
    fireEvent.click(screen.getByRole("button", { name: "花束 Bouquets" }));
    await waitFor(() => expect(apiMocks.searchProducts).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "調整排序" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "移動 testing" }), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "儲存排序" }));

    await waitFor(() => expect(apiMocks.reorderProducts).toHaveBeenCalledTimes(1));
    expect(apiMocks.reorderProducts).toHaveBeenCalledWith([
      { id: chocolateProduct.id, displaySequence: 10 },
      { id: testingProduct.id, displaySequence: 20 },
    ]);
    expect(apiMocks.updateProduct).not.toHaveBeenCalled();
    expect(await screen.findByText("商品排序已儲存")).toBeInTheDocument();
  });
});
