import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PrintButtons from "@/components/pos/PrintButtons";
import {
  generateAllDocuments,
  generateMessageCards,
  printDocument,
} from "@/lib/print-utils";
import type { Order } from "@/types/order";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { error: toastError },
}));

vi.mock("@/lib/print-utils", () => ({
  generateAllDocuments: vi.fn(() => "<html>all documents</html>"),
  generateReceipt: vi.fn(),
  generateDeliveryNote: vi.fn(),
  generateMessageCards: vi.fn(() => "<html>message cards</html>"),
  generatePickingList: vi.fn(),
  hasEnabledMessageCards: vi.fn((order: Order) => Boolean(
    order.giftCardEnabled || order.deliverySplits?.some((split) => split.giftCardEnabled),
  )),
  printDocument: vi.fn(),
}));

describe("PrintButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints every document in one print job", () => {
    const order = { id: "order-1" } as Order;

    render(<PrintButtons order={order} />);
    const printAllButton = screen.getByRole("button", { name: "全部列印" });
    expect(printAllButton).toHaveClass("min-h-11", "touch-manipulation");
    fireEvent.click(printAllButton);

    expect(generateAllDocuments).toHaveBeenCalledOnce();
    expect(generateAllDocuments).toHaveBeenCalledWith(order);
    expect(printDocument).toHaveBeenCalledOnce();
    expect(printDocument).toHaveBeenCalledWith("<html>all documents</html>");
  });

  it("prints message cards independently when any destination card is enabled", () => {
    const order = { id: "order-1", giftCardEnabled: true } as Order;

    render(<PrintButtons order={order} />);
    fireEvent.click(screen.getByRole("button", { name: "心意卡" }));

    expect(generateMessageCards).toHaveBeenCalledWith(order);
    expect(printDocument).toHaveBeenCalledWith("<html>message cards</html>");
  });

  it("omits message-card printing when no destination card is enabled", () => {
    const order = { id: "order-1", giftCardEnabled: false, deliverySplits: [] } as unknown as Order;

    render(<PrintButtons order={order} />);

    expect(screen.queryByRole("button", { name: "心意卡" })).not.toBeInTheDocument();
  });

  it("shows the exact allocation error instead of opening a broken print job", () => {
    const order = { id: "order-1" } as Order;
    vi.mocked(generateAllDocuments).mockImplementationOnce(() => {
      throw new Error("S17816-D2 商品分配未能對應 Odoo 訂單行");
    });

    render(<PrintButtons order={order} />);
    fireEvent.click(screen.getByRole("button", { name: "全部列印" }));

    expect(printDocument).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("S17816-D2 商品分配未能對應 Odoo 訂單行");
  });
});
