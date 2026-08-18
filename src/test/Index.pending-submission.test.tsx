import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Index from "@/pages/Index";
import {
  PENDING_SUBMISSION_KEY,
  type PendingOrderSubmission,
} from "@/lib/pending-submission";

const pendingSubmission = (): PendingOrderSubmission => ({
  order: {
    id: "43e81d2e-ccfb-415b-8799-12a2e7a528d4",
    salesId: "LOCAL — Cashier",
    operatorEmployeeId: 95,
    customerName: "Local Customer",
    senderName: "Local Sender",
    phone: "91234567",
    items: [{ id: "line-1", name: "Bouquet", price: 680, quantity: 1 }],
    deliveryFee: 0,
    urgentFee: 0,
    subtotal: 680,
    finalPrice: 680,
    priceOverridden: false,
    paymentStatus: "unpaid",
    depositAmount: 0,
    paymentMethod: "",
    deliveryDate: "2026-08-02",
    deliveryTime: "14:00",
    deliveryTimeMode: "specified",
    deliveryAddress: "Private delivery address",
    recipientType: "company",
    recipientCompanyName: "Private Recipient Limited",
    recipientName: "Private Contact",
    recipientPhone: "61234567",
    deliveryPerson: "",
    giftCardEnabled: false,
    giftCardMessage: "",
    senderNote: "",
    deliveryNote: "",
    internalNote: "",
    createdAt: "2026-08-01T10:00:00+08:00",
  },
  options: { customerType: "personal", companyName: "" },
  savedAt: new Date().toISOString(),
});

describe("Index pending recovery without POS authentication", () => {
  beforeEach(() => localStorage.clear());

  it("hydrates the raw local pending order when authentication is disabled", async () => {
    localStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(pendingSubmission()));

    render(<MemoryRouter><Index /></MemoryRouter>);

    expect(await screen.findByDisplayValue("Private Recipient Limited")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Private Contact")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Private delivery address")).toBeInTheDocument();
    expect(screen.getByText(/系統已恢復這部瀏覽器的未確認訂單/)).toBeInTheDocument();
    expect(screen.queryByText(/並不屬於目前登入員工/)).not.toBeInTheDocument();
  });

  it("releases a reviewed pending lock without clearing the restored form", async () => {
    localStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(pendingSubmission()));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MemoryRouter><Index /></MemoryRouter>);

    expect(await screen.findByDisplayValue("Private Recipient Limited")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {
      name: "核對 Odoo 後解除鎖定（保留資料）",
    }));

    await waitFor(() => {
      expect(localStorage.getItem(PENDING_SUBMISSION_KEY)).toBeNull();
    });
    expect(screen.getByDisplayValue("Private Recipient Limited")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Private Contact")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Private delivery address")).toBeInTheDocument();
    expect(screen.queryByText(/系統已恢復這部瀏覽器的未確認訂單/)).not.toBeInTheDocument();
  });
});
