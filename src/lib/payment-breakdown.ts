import type { Order } from "@/types/order";

type PaymentSnapshot = Pick<
  Order,
  | "finalPrice"
  | "paymentStatus"
  | "depositAmount"
  | "balanceAmount"
  | "customerCreditAmount"
  | "customerCreditApplied"
>;

export interface PaymentBreakdown {
  customerCredit: number;
  externalPayment: number;
  totalSettled: number;
  outstanding: number;
}

export const paymentBreakdown = (order: PaymentSnapshot): PaymentBreakdown => {
  const customerCredit = Math.max(
    0,
    order.customerCreditApplied ?? order.customerCreditAmount ?? 0,
  );
  const hasPostedBreakdown = order.customerCreditApplied !== undefined;
  const externalPayment = Math.max(
    0,
    hasPostedBreakdown
      ? order.depositAmount - customerCredit
      : order.paymentStatus === "paid"
        ? order.finalPrice - customerCredit
        : order.paymentStatus === "deposit"
          ? order.depositAmount
          : 0,
  );
  const totalSettled = customerCredit + externalPayment;
  const outstanding = Math.max(
    0,
    order.balanceAmount
      ?? (order.paymentStatus === "paid" ? 0 : order.finalPrice - totalSettled),
  );
  return { customerCredit, externalPayment, totalSettled, outstanding };
};
