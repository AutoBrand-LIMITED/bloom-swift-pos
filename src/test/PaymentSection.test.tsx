import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PaymentSection from "@/components/pos/PaymentSection";

const paymentOptions = [
  { code: "bank_in_fps", label: "Bank-in / FPS" },
  { code: "cash", label: "Cash" },
  { code: "card_terminal", label: "Card Terminal" },
];

const renderPaymentSection = (
  paymentStatus: "unpaid" | "paid" | "deposit" = "paid",
  paymentOptionsError: string | null = null,
  overrides: Partial<ComponentProps<typeof PaymentSection>> = {},
) => {
  const onPaymentMethodChange = vi.fn();
  const onCustomerCreditAmountChange = vi.fn();
  render(
    <PaymentSection
      subtotal={680}
      finalPrice={680}
      priceOverridden={false}
      allowPriceOverride={false}
      onFinalPriceChange={vi.fn()}
      onResetPrice={vi.fn()}
      paymentStatus={paymentStatus}
      onPaymentStatusChange={vi.fn()}
      paymentMethod=""
      onPaymentMethodChange={onPaymentMethodChange}
      paymentReference=""
      onPaymentReferenceChange={vi.fn()}
      paymentOptions={paymentOptions}
      paymentOptionsLoading={false}
      paymentOptionsError={paymentOptionsError}
      depositAmount={0}
      onDepositAmountChange={vi.fn()}
      customerCreditAvailable={0}
      customerCreditAmount={0}
      customerCreditLoading={false}
      customerCreditError={null}
      onCustomerCreditAmountChange={onCustomerCreditAmountChange}
      priceWarning={false}
      {...overrides}
    />,
  );
  return { onCustomerCreditAmountChange, onPaymentMethodChange };
};

describe("PaymentSection accounting payment options", () => {
  it("renders backend-approved Cash and Card Terminal codes for a paid order", () => {
    const { onPaymentMethodChange } = renderPaymentSection("paid");

    expect(screen.getByRole("button", { name: "Bank-in / FPS" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cash" }));
    fireEvent.click(screen.getByRole("button", { name: "Card Terminal" }));

    expect(onPaymentMethodChange).toHaveBeenNthCalledWith(1, "cash");
    expect(onPaymentMethodChange).toHaveBeenNthCalledWith(2, "card_terminal");
    expect(screen.getByLabelText("付款參考編號（建議填寫）")).not.toBeRequired();
    expect(screen.getByText("留空時系統會自動產生 POS 參考編號，唔會阻礙收款。")).toBeVisible();
  });

  it("does not show receipt methods for an unpaid order", () => {
    renderPaymentSection("unpaid");

    expect(screen.queryByRole("button", { name: "Cash" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("付款參考編號")).not.toBeInTheDocument();
  });

  it("warns without blocking when cached payment choices are being used", () => {
    renderPaymentSection("paid", "暫時未能更新 Odoo 收款設定");

    expect(screen.getByText(/現正沿用上次成功取得嘅付款方式/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Cash" })).toBeEnabled();
  });

  it("shows the available balance and defaults to the usable amount when enabled", () => {
    const { onCustomerCreditAmountChange } = renderPaymentSection("unpaid", null, {
      customerCreditAvailable: 800,
    });

    expect(screen.getByText("可用餘額 $800")).toBeVisible();
    fireEvent.click(screen.getByRole("switch", { name: "使用 Customer Credit" }));

    expect(onCustomerCreditAmountChange).toHaveBeenCalledWith(680);
  });

  it("allows a whole-dollar partial credit amount", () => {
    const { onCustomerCreditAmountChange } = renderPaymentSection("deposit", null, {
      customerCreditAvailable: 300,
      customerCreditAmount: 100,
    });

    fireEvent.change(screen.getByLabelText("今次使用 Customer Credit 金額"), {
      target: { value: "125" },
    });

    expect(onCustomerCreditAmountChange).toHaveBeenCalledWith(125);
    expect(screen.getByText("尚欠")).toHaveTextContent("$580");
  });

  it("does not ask for another payment method when credit covers the order", () => {
    renderPaymentSection("paid", null, {
      customerCreditAvailable: 680,
      customerCreditAmount: 680,
    });

    expect(screen.queryByRole("button", { name: "Cash" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("付款參考編號（建議填寫）")).not.toBeInTheDocument();
  });
});
