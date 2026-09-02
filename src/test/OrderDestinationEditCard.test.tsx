import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrderDestinationEditCard from "@/components/pos/OrderDestinationEditCard";
import { PICKUP_LOCATION_ADDRESS } from "@/lib/fulfillment";
import type { DeliverySplit } from "@/types/order";

const splitFixture = (fulfillmentType: "delivery" | "pickup"): DeliverySplit => ({
  id: "split-2",
  fulfillmentType,
  deliveryDate: "2026-08-27",
  deliveryTimeMode: "specified",
  deliveryTime: "下午 3 時前",
  deliveryRegion: fulfillmentType === "delivery" ? "九龍" : "",
  deliveryDistrict: fulfillmentType === "delivery" ? "觀塘區" : "",
  deliveryArea: fulfillmentType === "delivery" ? "觀塘" : "",
  deliveryDetail: fulfillmentType === "delivery" ? "巧明街 6 號" : "",
  deliveryAddress: fulfillmentType === "delivery" ? "九龍觀塘巧明街 6 號" : PICKUP_LOCATION_ADDRESS,
  deliveryGoogleAddress: fulfillmentType === "delivery" ? "九龍觀塘巧明街 6 號" : "",
  deliveryBuilding: fulfillmentType === "delivery" ? "巧運大廈" : "",
  deliveryFloor: fulfillmentType === "delivery" ? "7" : "",
  deliveryUnit: fulfillmentType === "delivery" ? "A" : "",
  recipientType: "company",
  recipientCompanyName: "Recipient Limited",
  recipientName: "Ms Recipient",
  recipientPhone: "61234567",
  recipientOccasions: [{ type: "birthday", date: "1990-01-02" }],
  recipientOccasionsVersion: "recipient-85-v4",
  recipientPartnerId: 85,
  deliveryPerson: "Driver A",
  failedDeliveryAction: "return_to_shop",
  deliveryNote: "Call first",
  itemAllocations: [{ itemId: "line-1", itemName: "Bouquet", quantity: 1 }],
});

describe("OrderDestinationEditCard fulfillment switching", () => {
  it("normalizes delivery to pickup without retaining delivery or recipient data", () => {
    const onChange = vi.fn();
    render(
      <OrderDestinationEditCard
        index={0}
        split={splitFixture("delivery")}
        deliverySlots={[]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "額外收貨點 2 收貨方式 *" }));
    fireEvent.click(screen.getByRole("option", { name: "自取" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      id: "split-2",
      fulfillmentType: "pickup",
      deliveryAddress: PICKUP_LOCATION_ADDRESS,
      deliveryRegion: "",
      deliveryGoogleAddress: "",
      deliveryBuilding: "",
      recipientType: "personal",
      recipientCompanyName: "",
      recipientName: "",
      recipientPhone: "",
      recipientOccasions: [],
      deliveryPerson: "",
      deliveryNote: "",
      itemAllocations: [{ itemId: "line-1", itemName: "Bouquet", quantity: 1 }],
    }));
  });

  it("clears pickup address and contact fields when switching back to delivery", () => {
    const onChange = vi.fn();
    render(
      <OrderDestinationEditCard
        index={0}
        split={splitFixture("pickup")}
        deliverySlots={[]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "額外收貨點 2 收貨方式 *" }));
    fireEvent.click(screen.getByRole("option", { name: "送貨" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      id: "split-2",
      fulfillmentType: "delivery",
      deliveryAddress: "",
      recipientType: "personal",
      recipientCompanyName: "",
      recipientName: "",
      recipientPhone: "",
      recipientOccasions: [],
      itemAllocations: [{ itemId: "line-1", itemName: "Bouquet", quantity: 1 }],
    }));
  });

  it("adds a split recipient occasion using that destination delivery date", () => {
    const onChange = vi.fn();
    render(
      <OrderDestinationEditCard
        index={0}
        split={{ ...splitFixture("delivery"), recipientOccasions: [] }}
        deliverySlots={[]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "新增額外收貨點 2 收花人重要日子" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      id: "split-2",
      recipientOccasions: [{
        type: "birthday",
        date: "2026-08-27",
        autoDateFromDelivery: true,
      }],
      recipientOccasionsVersion: "recipient-85-v4",
      recipientPartnerId: 85,
      itemAllocations: [{ itemId: "line-1", itemName: "Bouquet", quantity: 1 }],
    }));
  });

  it("clears a split recipient binding when an identity field changes", () => {
    const onChange = vi.fn();
    render(
      <OrderDestinationEditCard
        index={0}
        split={splitFixture("delivery")}
        deliverySlots={[]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("額外收貨點 2 收貨人／聯絡人"), {
      target: { value: "Different Recipient" },
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      recipientName: "Different Recipient",
      recipientPartnerId: undefined,
      recipientOccasionsVersion: undefined,
    }));
  });
});
