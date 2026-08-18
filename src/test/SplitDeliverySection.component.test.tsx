import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import SplitDeliverySection from "@/components/pos/SplitDeliverySection";
import type { DeliverySplit, FulfillmentType } from "@/types/order";

vi.mock("@/components/pos/DeliverySection", () => ({
  default: ({
    fulfillmentType,
    onFulfillmentTypeChange,
  }: {
    fulfillmentType: FulfillmentType;
    onFulfillmentTypeChange: (value: FulfillmentType) => void;
  }) => (
    <button
      type="button"
      onClick={() => onFulfillmentTypeChange(
        fulfillmentType === "delivery" ? "pickup" : "delivery",
      )}
    >
      {fulfillmentType === "delivery" ? "改為自取" : "改為送貨"}
    </button>
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
});
