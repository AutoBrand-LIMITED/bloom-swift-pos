import { describe, expect, it } from "vitest";

import {
  normalizeDeliverySplitsForSubmission,
  validateDeliverySplits,
} from "@/lib/split-delivery";
import type { DeliverySplit, OrderItem } from "@/types/order";

const items: OrderItem[] = [{ id: "line-1", name: "Bouquet", price: 100, quantity: 2 }];

const split = (quantity = 1): DeliverySplit => ({
  id: "split-2",
  fulfillmentType: "delivery",
  deliveryDate: "2026-08-18",
  deliveryTimeMode: "slot",
  deliverySlotId: 1,
  deliveryTime: "上午 09:00-13:00",
  deliveryRegion: "九龍",
  deliveryDistrict: "觀塘區",
  deliveryArea: "觀塘",
  deliveryDetail: "巧運工業大廈",
  deliveryAddress: "九龍 觀塘區 觀塘 巧運工業大廈",
  deliveryGoogleAddress: "九龍 觀塘區 觀塘 巧運工業大廈",
  deliveryBuilding: "",
  deliveryFloor: "",
  deliveryUnit: "",
  recipientType: "personal",
  recipientCompanyName: "",
  recipientName: "Ms Lee",
  recipientPhone: "62345678",
  deliveryPerson: "",
  failedDeliveryAction: "none",
  deliveryNote: "",
  itemAllocations: [{ itemId: "line-1", itemName: "Bouquet", quantity }],
});

describe("validateDeliverySplits", () => {
  it("accepts an additional destination within the ordered quantity", () => {
    expect(validateDeliverySplits([split()], items)).toBeNull();
  });

  it("rejects allocations above the original quantity across destinations", () => {
    expect(validateDeliverySplits([split(2), { ...split(1), id: "split-3" }], items))
      .toContain("超過原訂單數量");
  });

  it("requires complete recipient and address data", () => {
    expect(validateDeliverySplits([{ ...split(), recipientName: "" }], items))
      .toContain("收貨人名稱");
  });

  it("accepts pickup destinations with only date, time, and item allocations", () => {
    const pickup = {
      ...split(),
      fulfillmentType: "pickup" as const,
      deliveryAddress: "",
      recipientName: "",
      recipientPhone: "",
    };

    expect(validateDeliverySplits([pickup], items)).toBeNull();
  });

  it("normalizes hidden delivery details before submitting a pickup destination", () => {
    const pickup = normalizeDeliverySplitsForSubmission([{
      ...split(),
      fulfillmentType: "pickup",
    }])[0];

    expect(pickup).toMatchObject({
      fulfillmentType: "pickup",
      deliveryAddress: "",
      recipientName: "",
      recipientPhone: "",
      itemAllocations: [{ itemId: "line-1", quantity: 1 }],
    });
  });
});
