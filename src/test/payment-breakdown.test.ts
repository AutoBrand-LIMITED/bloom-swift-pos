import { describe, expect, it } from "vitest";
import { paymentBreakdown } from "@/lib/payment-breakdown";

describe("paymentBreakdown", () => {
  it("keeps requested credit separate from an unsynced mixed deposit", () => {
    expect(paymentBreakdown({
      finalPrice: 700,
      paymentStatus: "deposit",
      depositAmount: 100,
      customerCreditAmount: 500,
    })).toEqual({
      customerCredit: 500,
      externalPayment: 100,
      totalSettled: 600,
      outstanding: 100,
    });
  });

  it("separates posted credit from the total settled accounting snapshot", () => {
    expect(paymentBreakdown({
      finalPrice: 700,
      paymentStatus: "deposit",
      depositAmount: 600,
      balanceAmount: 100,
      customerCreditApplied: 500,
    })).toEqual({
      customerCredit: 500,
      externalPayment: 100,
      totalSettled: 600,
      outstanding: 100,
    });
  });

  it("recognizes a fully credit-paid order without an external receipt", () => {
    expect(paymentBreakdown({
      finalPrice: 700,
      paymentStatus: "paid",
      depositAmount: 700,
      balanceAmount: 0,
      customerCreditApplied: 700,
    })).toEqual({
      customerCredit: 700,
      externalPayment: 0,
      totalSettled: 700,
      outstanding: 0,
    });
  });
});
