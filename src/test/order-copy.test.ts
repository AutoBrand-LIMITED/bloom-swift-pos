import { describe, expect, it } from "vitest";

import { cloneOrderContent } from "@/lib/order-copy";

describe("cloneOrderContent", () => {
  it("creates fresh line and destination identities while preserving allocations", () => {
    const ids = ["new-line", "new-destination"];
    const result = cloneOrderContent({
      items: [{ id: "old-line", name: "Bouquet", price: 680, quantity: 2 }],
      deliverySplits: [{
        id: "old-destination",
        fulfillmentType: "delivery",
        deliveryDate: "2026-09-12",
        deliveryTimeMode: "slot",
        deliveryTime: "上午 09:00-13:00",
        deliveryRegion: "香港島",
        deliveryDistrict: "中西區",
        deliveryArea: "中環",
        deliveryDetail: "Central",
        deliveryAddress: "Central",
        deliveryGoogleAddress: "Central",
        deliveryBuilding: "",
        deliveryFloor: "",
        deliveryUnit: "",
        recipientType: "personal",
        recipientCompanyName: "",
        recipientName: "Recipient",
        recipientPhone: "61234567",
        deliveryPerson: "",
        failedDeliveryAction: "none",
        deliveryNote: "",
        giftCardEnabled: false,
        giftCardMessage: "",
        itemAllocations: [{ itemId: "old-line", itemName: "Bouquet", quantity: 1 }],
      }],
    }, () => ids.shift()!);

    expect(result.items[0].id).toBe("new-line");
    expect(result.deliverySplits[0].id).toBe("new-destination");
    expect(result.deliverySplits[0].itemAllocations).toEqual([
      { itemId: "new-line", itemName: "Bouquet", quantity: 1 },
    ]);
  });
});
