import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import SplitDeliverySection from "@/components/pos/SplitDeliverySection";
import type { DeliverySplit, FulfillmentType } from "@/types/order";

vi.mock("@/components/pos/DeliverySection", () => ({
  default: ({
    fulfillmentType,
    onFulfillmentTypeChange,
    recipientName,
    recipientPhone,
    senderType,
    senderCompanyName,
    senderName,
    senderPhone,
    onRecipientDetailsChange,
  }: {
    fulfillmentType: FulfillmentType;
    onFulfillmentTypeChange: (value: FulfillmentType) => void;
    recipientName: string;
    recipientPhone: string;
    senderType: "personal" | "company";
    senderCompanyName: string;
    senderName: string;
    senderPhone: string;
    onRecipientDetailsChange: (recipient: {
      type: "personal" | "company";
      companyName: string;
      name: string;
      phone: string;
    }) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onFulfillmentTypeChange(
          fulfillmentType === "delivery" ? "pickup" : "delivery",
        )}
      >
        {fulfillmentType === "delivery" ? "改為自取" : "改為送貨"}
      </button>
      <button
        type="button"
        aria-label="收貨人同送花人相同"
        onClick={() => onRecipientDetailsChange({
          type: senderType,
          companyName: senderCompanyName,
          name: senderName,
          phone: senderPhone,
        })}
      >
        套用送花人
      </button>
      <output aria-label="拆單收貨人">{recipientName}|{recipientPhone}</output>
    </div>
  ),
}));

const Harness = () => {
  const [splits, setSplits] = useState<DeliverySplit[]>([]);
  return (
    <SplitDeliverySection
      items={[{ id: "line-1", name: "Bouquet", price: 100, quantity: 2 }]}
      splits={splits}
      onChange={setSplits}
      defaultDeliveryDate="2026-08-18"
      defaultDeliveryTime="上午 09:00-13:00"
      defaultDeliveryTimeMode="slot"
      defaultDeliverySlotId={1}
      deliverySlots={[]}
      deliverySlotsLoading={false}
      deliverySlotsError={null}
      onRetryDeliverySlots={vi.fn()}
      senderType="personal"
      senderCompanyName=""
      senderName="Ms Chan"
      senderPhone="61234567"
    />
  );
};

describe("SplitDeliverySection fulfillment controls", () => {
  it("creates an independent destination and allows switching it to pickup", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    expect(screen.getByRole("button", { name: "改為自取" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "改為自取" }));
    expect(screen.getByRole("button", { name: "改為送貨" })).toBeVisible();
  });

  it("applies the sender name and phone to a split destination in one update", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /新增另一個收貨點/ }));
    fireEvent.click(screen.getByRole("button", { name: "收貨人同送花人相同" }));

    expect(screen.getByRole("status", { name: "拆單收貨人" })).toHaveTextContent(
      "Ms Chan|61234567",
    );
  });
});
