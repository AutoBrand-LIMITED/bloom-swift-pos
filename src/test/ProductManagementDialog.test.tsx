import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProductManagementDialog from "@/components/pos/ProductManagementDialog";

const originalAnimateDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
const originalSetPointerCaptureDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "setPointerCapture",
);
const originalHasPointerCaptureDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "hasPointerCapture",
);
const originalReleasePointerCaptureDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "releasePointerCapture",
);

const restorePrototypeProperty = (
  property: string,
  descriptor: PropertyDescriptor | undefined,
) => {
  if (descriptor) Object.defineProperty(HTMLElement.prototype, property, descriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, property);
};

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

const giftProduct = {
  ...testingProduct,
  id: 4340,
  name: "Gift",
  productCode: "GIFT",
  templateId: 4340,
  barcode: "4340",
  categoryId: 2,
  categoryName: "禮物 Gifts",
  displaySequence: 20,
};

const vaseProduct = {
  ...giftProduct,
  id: 4341,
  name: "Vase",
  productCode: "VASE",
  templateId: 4341,
  barcode: "4341",
  displaySequence: 40,
};

const gridProducts = Array.from({ length: 6 }, (_, index) => ({
  ...testingProduct,
  id: 4401 + index,
  templateId: 4401 + index,
  name: `Grid product ${index + 1}`,
  productCode: `GRID-${index + 1}`,
}));

const rect = (left: number, top: number, width = 100, height = 120): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
  toJSON: () => ({}),
} as DOMRect);

const setThreeColumnCardGeometry = () => {
  const cards = screen.getAllByRole("button", { name: /^移動 Grid product/ })
    .map((handle) => handle.closest<HTMLElement>("[data-product-sort-id]")!);
  cards.forEach((card) => {
    vi.spyOn(card, "getBoundingClientRect").mockImplementation(() => {
      const currentCards = Array.from(card.parentElement!.children);
      const index = currentCards.indexOf(card);
      return rect((index % 3) * 120, Math.floor(index / 3) * 150);
    });
  });
};

const startGridSorting = async () => {
  apiMocks.searchProducts.mockResolvedValue(gridProducts);
  const view = renderDialog();
  await screen.findByText("Grid product 6");
  fireEvent.click(screen.getByRole("button", { name: "花束 Bouquets" }));
  await waitFor(() => expect(apiMocks.searchProducts).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole("button", { name: "調整排序" }));
  await screen.findByRole("button", { name: "移動 Grid product 1" });
  setThreeColumnCardGeometry();
  return view;
};

const orderedDragHandleNames = () => screen
  .getAllByRole("button", { name: /^移動 Grid product/ })
  .map((button) => button.getAttribute("aria-label"));

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
    vi.stubGlobal("PointerEvent", class extends MouseEvent {
      pointerId: number;
      pointerType: string;

      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? "";
      }
    });
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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    restorePrototypeProperty("animate", originalAnimateDescriptor);
    restorePrototypeProperty("setPointerCapture", originalSetPointerCaptureDescriptor);
    restorePrototypeProperty("hasPointerCapture", originalHasPointerCaptureDescriptor);
    restorePrototypeProperty("releasePointerCapture", originalReleasePointerCaptureDescriptor);
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
    await screen.findByRole("button", { name: "移動 testing" });
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

  it("allows the All view to define the shared global product order", async () => {
    apiMocks.searchProducts.mockResolvedValue([
      { ...testingProduct, displaySequence: 10 },
      { ...chocolateProduct, displaySequence: 20 },
    ]);
    renderDialog();

    await screen.findByText("Chocolate");
    fireEvent.click(screen.getByRole("button", { name: "調整排序" }));
    expect(screen.getByText("「全部」係全域順序；各分類會沿用同一套次序。")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "移動 testing" }), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "儲存排序" }));

    await waitFor(() => expect(apiMocks.reorderProducts).toHaveBeenCalledTimes(1));
    expect(apiMocks.reorderProducts).toHaveBeenCalledWith([
      { id: chocolateProduct.id, displaySequence: 10 },
      { id: testingProduct.id, displaySequence: 20 },
    ]);
  });

  it("merges a category reorder into the shared global order without colliding with other categories", async () => {
    const firstBouquet = { ...testingProduct, displaySequence: 10 };
    const secondBouquet = { ...chocolateProduct, displaySequence: 30 };
    const allProducts = [firstBouquet, giftProduct, secondBouquet, vaseProduct];
    apiMocks.searchProducts.mockImplementation(async (
      _query: string,
      _signal?: AbortSignal,
      categoryId?: number,
    ) => categoryId === 1 ? [firstBouquet, secondBouquet] : allProducts);
    renderDialog();

    await screen.findByText("Vase");
    fireEvent.click(screen.getByRole("button", { name: "花束 Bouquets" }));
    await waitFor(() => expect(screen.queryByText("Vase")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "調整排序" }));
    await screen.findByRole("button", { name: "移動 testing" });
    fireEvent.keyDown(screen.getByRole("button", { name: "移動 testing" }), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "儲存排序" }));

    await waitFor(() => expect(apiMocks.reorderProducts).toHaveBeenCalledTimes(1));
    expect(apiMocks.reorderProducts).toHaveBeenCalledWith([
      { id: chocolateProduct.id, displaySequence: 10 },
      { id: testingProduct.id, displaySequence: 30 },
    ]);
  });

  it("targets the nearest card center when dragging diagonally across a three-column grid", async () => {
    await startGridSorting();
    const bottomRightHandle = screen.getByRole("button", { name: "移動 Grid product 6" });

    fireEvent.pointerDown(bottomRightHandle, {
      pointerId: 7,
      pointerType: "mouse",
      clientX: 290,
      clientY: 210,
    });
    fireEvent.pointerMove(bottomRightHandle, {
      pointerId: 7,
      pointerType: "mouse",
      clientX: 52,
      clientY: 62,
    });

    expect(orderedDragHandleNames()[0]).toBe("移動 Grid product 6");
    expect(screen.getByText("拖拉商品到新位置，完成後儲存排序。")).toBeInTheDocument();
  });

  it("does not reorder repeatedly while the pointer is in the gap between cards", async () => {
    await startGridSorting();
    const bottomRightHandle = screen.getByRole("button", { name: "移動 Grid product 6" });
    const scrollContainer = bottomRightHandle.closest<HTMLElement>(".overflow-y-auto")!;

    fireEvent.pointerDown(bottomRightHandle, {
      pointerId: 72,
      pointerType: "mouse",
      clientX: 290,
      clientY: 210,
    });
    fireEvent.pointerMove(scrollContainer, {
      pointerId: 72,
      pointerType: "mouse",
      clientX: 110,
      clientY: 60,
    });
    fireEvent.pointerMove(scrollContainer, {
      pointerId: 72,
      pointerType: "mouse",
      clientX: 111,
      clientY: 61,
    });

    expect(orderedDragHandleNames()).toEqual([
      "移動 Grid product 1",
      "移動 Grid product 2",
      "移動 Grid product 3",
      "移動 Grid product 4",
      "移動 Grid product 5",
      "移動 Grid product 6",
    ]);

    fireEvent.pointerMove(scrollContainer, {
      pointerId: 72,
      pointerType: "mouse",
      clientX: 52,
      clientY: 62,
    });
    expect(orderedDragHandleNames()[0]).toBe("移動 Grid product 6");
  });

  it("keeps capture on the stable scroll container across consecutive DOM reorders", async () => {
    const setPointerCapture = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: setPointerCapture,
    });
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => true),
    });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    await startGridSorting();
    const draggedHandle = screen.getByRole("button", { name: "移動 Grid product 6" });
    const scrollContainer = draggedHandle.closest<HTMLElement>(".overflow-y-auto")!;

    fireEvent.pointerDown(draggedHandle, {
      pointerId: 71,
      pointerType: "mouse",
      clientX: 290,
      clientY: 210,
    });
    expect(setPointerCapture).toHaveBeenCalledWith(71);
    expect(setPointerCapture.mock.contexts[0]).toBe(scrollContainer);
    expect(setPointerCapture.mock.contexts[0]).not.toBe(draggedHandle);

    fireEvent.pointerMove(scrollContainer, {
      pointerId: 71,
      pointerType: "mouse",
      clientX: 52,
      clientY: 62,
    });
    expect(orderedDragHandleNames()[0]).toBe("移動 Grid product 6");

    fireEvent.pointerMove(scrollContainer, {
      pointerId: 71,
      pointerType: "mouse",
      clientX: 172,
      clientY: 212,
    });
    expect(orderedDragHandleNames()).toEqual([
      "移動 Grid product 1",
      "移動 Grid product 2",
      "移動 Grid product 3",
      "移動 Grid product 4",
      "移動 Grid product 6",
      "移動 Grid product 5",
    ]);
    expect(setPointerCapture).toHaveBeenCalledTimes(1);
  });

  it("FLIP-animates displaced siblings after a drag reorder", async () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() } as unknown as Animation));
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    await startGridSorting();
    const bottomRightHandle = screen.getByRole("button", { name: "移動 Grid product 6" });

    fireEvent.pointerDown(bottomRightHandle, {
      pointerId: 8,
      pointerType: "mouse",
      clientX: 290,
      clientY: 210,
    });
    fireEvent.pointerMove(bottomRightHandle, {
      pointerId: 8,
      pointerType: "mouse",
      clientX: 52,
      clientY: 62,
    });

    expect(animate).toHaveBeenCalled();
    expect(animate.mock.contexts).not.toContain(bottomRightHandle.closest("article"));
    expect(animate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ transform: expect.stringContaining("translate3d(") }),
        { transform: "translate3d(0, 0, 0)" },
      ]),
      expect.objectContaining({ duration: 220 }),
    );
  });

  it("does not animate reflow when reduced motion is requested", async () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() } as unknown as Animation));
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    await startGridSorting();
    const bottomRightHandle = screen.getByRole("button", { name: "移動 Grid product 6" });

    fireEvent.pointerDown(bottomRightHandle, {
      pointerId: 9,
      pointerType: "mouse",
      clientX: 290,
      clientY: 210,
    });
    fireEvent.pointerMove(bottomRightHandle, {
      pointerId: 9,
      pointerType: "mouse",
      clientX: 52,
      clientY: 62,
    });

    expect(orderedDragHandleNames()[0]).toBe("移動 Grid product 6");
    expect(animate).not.toHaveBeenCalled();
  });

  it.each(["pointerup", "pointercancel", "lostpointercapture", "blur"])(
    "ends an active drag on %s and ignores later pointer movement",
    async (endEvent) => {
      await startGridSorting();
      const bottomRightHandle = screen.getByRole("button", { name: "移動 Grid product 6" });
      fireEvent.pointerDown(bottomRightHandle, {
        pointerId: 10,
        pointerType: "mouse",
        clientX: 290,
        clientY: 210,
      });

      if (endEvent === "blur") {
        fireEvent.blur(window);
      } else {
        const event = new Event(endEvent, { bubbles: true });
        Object.defineProperty(event, "pointerId", { value: 10 });
        fireEvent(bottomRightHandle, event);
      }
      fireEvent.pointerMove(bottomRightHandle, {
        pointerId: 10,
        pointerType: "mouse",
        clientX: 52,
        clientY: 62,
      });

      expect(orderedDragHandleNames()).toEqual(gridProducts.map((product) => `移動 ${product.name}`));
      expect(bottomRightHandle.closest("article")).not.toHaveClass("opacity-70");
    },
  );

  it.each(["dialog close", "unmount"])(
    "clears a pending touch long-press on %s",
    async (cleanup) => {
      const view = await startGridSorting();
      const handle = screen.getByRole("button", { name: "移動 Grid product 1" });
      const setTimeout = vi.spyOn(window, "setTimeout");

      fireEvent.pointerDown(handle, { pointerId: 11, pointerType: "touch", clientX: 50, clientY: 60 });
      const dragTimer = setTimeout.mock.results.at(-1)?.value;
      const clearTimeout = vi.spyOn(window, "clearTimeout");
      act(() => {
        if (cleanup === "dialog close") {
          view.rerender(
            <ProductManagementDialog
              open={false}
              onOpenChange={vi.fn()}
              categories={[{ id: 1, name: "花束 Bouquets", parent_id: null, sequence: 1 }]}
              onCatalogChanged={vi.fn()}
            />,
          );
        } else {
          view.unmount();
        }
      });

      expect(clearTimeout).toHaveBeenCalledWith(dragTimer);
    },
  );
});
