import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Order } from "@/types/order";

const mocks = vi.hoisted(() => ({
  generateAllDocuments: vi.fn(() => "all-documents"),
  generateReceipt: vi.fn(() => "receipt"),
  printDocument: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/lib/print-utils", () => ({
  generateAllDocuments: mocks.generateAllDocuments,
  generateReceipt: mocks.generateReceipt,
  printDocument: mocks.printDocument,
}));

import {
  showOrderSubmissionFailure,
  showOrderSubmissionSuccess,
} from "@/lib/order-submission-feedback";

const order = { id: "checkout-1" } as Order;

describe("order submission feedback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows one customer-facing success notification without backend details", () => {
    showOrderSubmissionSuccess(order);

    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "訂單已完成",
      expect.objectContaining({
        description: "選擇要列印嘅單據：",
      }),
    );
    expect(JSON.stringify(mocks.toastSuccess.mock.calls)).not.toMatch(/Odoo|staging|undefined/);

    const options = mocks.toastSuccess.mock.calls[0][1];
    options.action.onClick();
    options.cancel.onClick();

    expect(mocks.generateReceipt).toHaveBeenCalledWith(order);
    expect(mocks.generateAllDocuments).toHaveBeenCalledWith(order);
    expect(mocks.printDocument).toHaveBeenNthCalledWith(1, "receipt");
    expect(mocks.printDocument).toHaveBeenNthCalledWith(2, "all-documents");
  });

  it("shows only a simple failure notification", () => {
    showOrderSubmissionFailure();

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).toHaveBeenCalledWith("下單失敗");
  });
});
