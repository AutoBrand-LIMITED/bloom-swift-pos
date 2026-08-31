import { describe, expect, it } from "vitest";

import {
  normalizeDeliverySplitsForSubmission,
  normalizeDeliverySplitsForOperationalUpdate,
  operationalSplitIdentityIsUnchanged,
  validateDeliverySplits,
  validateOperationalDeliverySplits,
} from "@/lib/split-delivery";
import { PICKUP_LOCATION_ADDRESS } from "@/lib/fulfillment";
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
      deliveryAddress: PICKUP_LOCATION_ADDRESS,
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
      deliveryAddress: PICKUP_LOCATION_ADDRESS,
      recipientName: "",
      recipientPhone: "",
      itemAllocations: [{ itemId: "line-1", quantity: 1 }],
    });
  });

  it("normalizes destination cards without mixing or retaining disabled text", () => {
    const normalized = normalizeDeliverySplitsForSubmission([
      { ...split(), giftCardEnabled: true, giftCardMessage: "  First split card  " },
      { ...split(), id: "split-3", giftCardEnabled: false, giftCardMessage: "stale" },
    ]);

    expect(normalized[0]).toMatchObject({
      giftCardEnabled: true,
      giftCardMessage: "First split card",
    });
    expect(normalized[1]).toMatchObject({
      giftCardEnabled: false,
      giftCardMessage: "",
    });
  });

  it("preserves two independent split birthdays", () => {
    const normalized = normalizeDeliverySplitsForSubmission([
      { ...split(), recipientBirthday: "1990-01-02", recipientPartnerId: 85 },
      { ...split(), id: "split-3", recipientBirthday: "1985-11-12", recipientPartnerId: 86 },
    ]);

    expect(normalized.map((destination) => destination.recipientBirthday)).toEqual([
      "1990-01-02",
      "1985-11-12",
    ]);
    expect(normalized.map((destination) => destination.recipientPartnerId)).toEqual([85, 86]);
  });

  it("serializes explicit empty birthdays for fresh bound D2 and D3 recipients", () => {
    const normalized = normalizeDeliverySplitsForSubmission([
      { ...split(), recipientBirthday: "", recipientPartnerId: 85 },
      { ...split(), id: "split-3", recipientBirthday: "", recipientPartnerId: 86 },
    ]);

    expect(normalized[0]).toHaveProperty("recipientBirthday", "");
    expect(normalized[0]).toHaveProperty("recipientPartnerId", 85);
    expect(normalized[1]).toHaveProperty("recipientBirthday", "");
    expect(normalized[1]).toHaveProperty("recipientPartnerId", 86);
  });

  it("omits birthdays for fresh bound D2 and D3 recipients when suggestions omitted the field", () => {
    const normalized = normalizeDeliverySplitsForSubmission([
      { ...split(), recipientPartnerId: 85 },
      { ...split(), id: "split-3", recipientPartnerId: 86 },
    ]);

    expect(normalized[0]).not.toHaveProperty("recipientBirthday");
    expect(normalized[0]).toHaveProperty("recipientPartnerId", 85);
    expect(normalized[1]).not.toHaveProperty("recipientBirthday");
    expect(normalized[1]).toHaveProperty("recipientPartnerId", 86);
  });

  it("adds explicit disabled card fields for a new destination", () => {
    const normalized = normalizeDeliverySplitsForSubmission([split()]);

    expect(normalized[0]).toHaveProperty("giftCardEnabled", false);
    expect(normalized[0]).toHaveProperty("giftCardMessage", "");
  });

  it("preserves pickup contact details and historical allocations during operational edits", () => {
    const original = [{
      ...split(),
      fulfillmentType: "pickup" as const,
      deliveryAddress: "",
      recipientName: "Pickup Contact",
      recipientPhone: "63334444",
    }];
    const normalized = normalizeDeliverySplitsForOperationalUpdate(original);

    expect(normalized[0]).toMatchObject({
      id: "split-2",
      fulfillmentType: "pickup",
      deliveryAddress: PICKUP_LOCATION_ADDRESS,
      recipientName: "Pickup Contact",
      recipientPhone: "63334444",
      itemAllocations: original[0].itemAllocations,
    });
    expect(operationalSplitIdentityIsUnchanged(original, normalized)).toBe(true);
    expect(validateOperationalDeliverySplits(normalized)).toBeNull();
  });

  it("preserves an explicit split birthday clear and recipient binding for operational edits", () => {
    const normalized = normalizeDeliverySplitsForOperationalUpdate([{
      ...split(),
      recipientBirthday: "",
      recipientPartnerId: 85,
    }]);

    expect(normalized[0]).toHaveProperty("recipientBirthday", "");
    expect(normalized[0]).toHaveProperty("recipientPartnerId", 85);
  });

  it("rejects changed destination IDs or allocations during operational edits", () => {
    const original = [split()];

    expect(operationalSplitIdentityIsUnchanged(original, [{ ...split(), id: "replacement" }]))
      .toBe(false);
    expect(operationalSplitIdentityIsUnchanged(original, [{
      ...split(),
      itemAllocations: [{ ...split().itemAllocations[0], quantity: 2 }],
    }])).toBe(false);
  });
});
