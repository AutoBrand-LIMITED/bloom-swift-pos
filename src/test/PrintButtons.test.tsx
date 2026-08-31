import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PrintButtons from "@/components/pos/PrintButtons";
import {
  generateAllDocuments,
  generateMessageCards,
  printDocument,
} from "@/lib/print-utils";
import type { Order } from "@/types/order";

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
    fireEvent.click(screen.getByRole("button", { name: "全部列印" }));

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
});
