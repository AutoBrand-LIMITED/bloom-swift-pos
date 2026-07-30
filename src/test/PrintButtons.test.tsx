import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PrintButtons from "@/components/pos/PrintButtons";
import {
  generateAllDocuments,
  printDocument,
} from "@/lib/print-utils";
import type { Order } from "@/types/order";

vi.mock("@/lib/print-utils", () => ({
  generateAllDocuments: vi.fn(() => "<html>all documents</html>"),
  generateReceipt: vi.fn(),
  generateDeliveryNote: vi.fn(),
  generatePickingList: vi.fn(),
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
});
