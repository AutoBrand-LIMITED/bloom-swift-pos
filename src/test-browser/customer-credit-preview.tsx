import { useState } from "react";
import { createRoot } from "react-dom/client";
import PaymentSection from "@/components/pos/PaymentSection";
import type { PaymentStatus } from "@/types/order";
import "@/index.css";

const FINAL_PRICE = 700;

export const CustomerCreditPreview = () => {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [paymentMethod, setPaymentMethod] = useState("cash_other");
  const [paymentReference, setPaymentReference] = useState("");
  const [depositAmount, setDepositAmount] = useState(0);
  const [customerCreditAmount, setCustomerCreditAmount] = useState(0);

  const updateCustomerCredit = (amount: number) => {
    const nextAmount = Math.max(0, Math.min(FINAL_PRICE, Math.floor(amount)));
    setCustomerCreditAmount(nextAmount);
    setPaymentStatus(nextAmount <= 0 ? "unpaid" : nextAmount >= FINAL_PRICE ? "paid" : "deposit");
    if (nextAmount >= FINAL_PRICE) setDepositAmount(0);
  };

  return (
    <main className="min-h-screen bg-background p-8">
      <section className="mx-auto max-w-3xl space-y-4" aria-label="Customer Credit browser preview">
        <div>
          <p className="text-sm font-medium text-emerald-700">Browser verification</p>
          <h1 className="text-2xl font-semibold">Customer Credit 付款流程</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            測試足額、部分及混合付款時嘅實際互動狀態。
          </p>
        </div>
        <PaymentSection
          subtotal={FINAL_PRICE}
          finalPrice={FINAL_PRICE}
          priceOverridden={false}
          allowPriceOverride={false}
          onFinalPriceChange={() => undefined}
          onResetPrice={() => undefined}
          paymentStatus={paymentStatus}
          onPaymentStatusChange={setPaymentStatus}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          paymentReference={paymentReference}
          onPaymentReferenceChange={setPaymentReference}
          paymentOptions={[
            { code: "cash_other", label: "現金 / 其他" },
            { code: "bank_in_fps", label: "銀行入數 / FPS" },
          ]}
          paymentOptionsLoading={false}
          paymentOptionsError={null}
          depositAmount={depositAmount}
          onDepositAmountChange={setDepositAmount}
          customerCreditAvailable={900}
          customerCreditAmount={customerCreditAmount}
          customerCreditLoading={false}
          customerCreditError={null}
          onCustomerCreditAmountChange={updateCustomerCredit}
          priceWarning={false}
        />
      </section>
    </main>
  );
};

createRoot(document.getElementById("root")!).render(<CustomerCreditPreview />);
