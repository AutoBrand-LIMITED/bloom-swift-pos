import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProductManagementDialog from "@/components/pos/ProductManagementDialog";

const apiMocks = vi.hoisted(() => ({
  searchProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock("@/lib/odoo-api", () => ({
  hasOdooBackend: true,
  searchManageableOdooProducts: apiMocks.searchProducts,
  createOdooProduct: apiMocks.createProduct,
  updateOdooProduct: apiMocks.updateProduct,
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
  displaySequence: 20,
  availableFrom: "2026-02-01",
  availableUntil: "2026-02-28",
  imageUrl: "",
};

describe("ProductManagementDialog", () => {
  beforeEach(() => {
    apiMocks.searchProducts.mockReset();
    apiMocks.searchProducts.mockResolvedValue([testingProduct]);
  });

  it("keeps a new-product form blank when the product list finishes loading", async () => {
    render(
      <ProductManagementDialog
        open
        onOpenChange={vi.fn()}
        categories={[{ id: 1, name: "花束 Bouquets", parent_id: null, sequence: 1 }]}
        onCatalogChanged={vi.fn()}
      />
    );

    const nameInput = screen.getByLabelText("商品名稱");
    await waitFor(() => expect(nameInput).toHaveValue("testing"));

    fireEvent.click(screen.getByRole("button", { name: "新增商品" }));
    expect(nameInput).toHaveValue("");

    fireEvent.change(nameInput, { target: { value: "Browser UX Probe" } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(nameInput).toHaveValue("Browser UX Probe");
    expect(screen.getByLabelText("Product Code")).toHaveValue("");
    expect(screen.getByLabelText("售價 ($)")).toHaveValue(null);
    expect(screen.getByLabelText("Barcode")).toHaveValue("");
    expect(screen.getByLabelText("POS 排序")).toHaveValue(100);
    expect(screen.getByLabelText("開始顯示日期")).toHaveValue("");
    expect(screen.getByLabelText("結束顯示日期")).toHaveValue("");
    expect(apiMocks.searchProducts).toHaveBeenCalledTimes(1);
  });
});
