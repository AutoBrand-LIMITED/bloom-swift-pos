import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Index from "@/pages/Index";
import {
  PENDING_SUBMISSION_KEY,
  type PendingOrderSubmission,
} from "@/lib/pending-submission";
import type { DeliverySplit } from "@/types/order";

const pendingSplit = (
  id: string,
  recipientName: string,
  recipientBirthday: string,
  giftCardMessage: string,
): DeliverySplit => ({
  id,
  fulfillmentType: "delivery",
  deliveryDate: "2026-08-03",
  deliveryTimeMode: "specified",
  deliveryTime: "15:00",
  deliveryRegion: "九龍",
  deliveryDistrict: "觀塘區",
  deliveryArea: "觀塘",
  deliveryDetail: `${recipientName} address`,
  deliveryAddress: `${recipientName} address`,
  deliveryGoogleAddress: `${recipientName} address`,
  deliveryBuilding: "",
  deliveryFloor: "",
  deliveryUnit: "",
  recipientType: "personal",
  recipientCompanyName: "",
  recipientName,
  recipientPhone: "61234567",
  recipientBirthday,
  recipientPartnerId: id === "split-2" ? 85 : 86,
  deliveryPerson: "",
  failedDeliveryAction: "none",
  deliveryNote: "",
  giftCardEnabled: true,
  giftCardMessage,
  itemAllocations: [{ itemId: "line-1", itemName: "Bouquet", quantity: 1 }],
});

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
    recipientBirthday: "1990-01-02",
    recipientPartnerId: 84,
    deliveryPerson: "",
    deliverySplits: [
      pendingSplit("split-2", "Second Contact", "1985-11-12", "D2 private card"),
      pendingSplit("split-3", "Third Contact", "1978-06-30", "D3 private card"),
    ],
    giftCardEnabled: true,
    giftCardMessage: "D1 private card",
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
    expect(screen.getByLabelText("收貨方式 收件人生日")).toHaveValue("1990-01-02");
    expect(screen.getByLabelText("額外收貨資料 2 收件人生日")).toHaveValue("1985-11-12");
    expect(screen.getByLabelText("額外收貨資料 3 收件人生日")).toHaveValue("1978-06-30");
    expect(screen.getByLabelText("主要收貨點心意卡內容")).toHaveValue("D1 private card");
    expect(screen.getByLabelText("拆單收貨點 2 心意卡內容")).toHaveValue("D2 private card");
    expect(screen.getByLabelText("拆單收貨點 3 心意卡內容")).toHaveValue("D3 private card");
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

  it("keeps the D1 recipient partner binding after a birthday-only edit", async () => {
    localStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(pendingSubmission()));

    render(<MemoryRouter><Index /></MemoryRouter>);

    expect(await screen.findByRole("button", {
      name: "重新載入收花人長期備註",
    })).toBeVisible();
    fireEvent.change(screen.getByLabelText("收貨方式 收件人生日"), {
      target: { value: "1991-02-03" },
    });
    expect(screen.getByRole("button", {
      name: "重新載入收花人長期備註",
    })).toBeVisible();
  });
});
