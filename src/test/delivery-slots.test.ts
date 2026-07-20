import { describe, expect, it } from "vitest";

import {
  DEMO_DELIVERY_SLOTS,
  deliverySlotSnapshot,
  findDeliverySlot,
  validateDeliveryTimeSelection,
} from "@/lib/delivery-slots";
import type { DeliverySlot } from "@/lib/odoo-api";

const slot: DeliverySlot = {
  id: 31,
  displayLabel: "上午 09:00-13:00",
  startTime: "09:00",
  endTime: "13:00",
};

describe("delivery slot helpers", () => {
  it("provides the two contract defaults only for callers in demo mode", () => {
    expect(DEMO_DELIVERY_SLOTS.map(deliverySlotSnapshot)).toEqual([
      "上午 09:00-13:00",
      "下午 13:00-18:00",
    ]);
  });

  it("uses a time range when the backend display label is blank", () => {
    expect(deliverySlotSnapshot({ ...slot, displayLabel: "  " })).toBe("09:00-13:00");
    expect(findDeliverySlot([slot], 31)).toBe(slot);
    expect(findDeliverySlot([slot], 99)).toBeUndefined();
  });

  it("keeps new-order slot validation strict when the live label changes", () => {
    expect(validateDeliveryTimeSelection({
      deliveryDate: "2026-07-17",
      deliveryTime: slot.displayLabel,
      deliveryTimeMode: "slot",
      deliverySlotId: slot.id,
      slots: [slot],
    })).toBeNull();
    expect(validateDeliveryTimeSelection({
      deliveryDate: "2026-07-17",
      deliveryTime: "old label",
      deliveryTimeMode: "slot",
      deliverySlotId: slot.id,
      slots: [slot],
    })).toContain("內容已更新");
  });

  it("requires specified text and a delivery date", () => {
    expect(validateDeliveryTimeSelection({
      deliveryDate: "2026-07-17",
      deliveryTime: "  ",
      deliveryTimeMode: "specified",
      deliverySlotId: undefined,
      slots: [],
    })).toBe("請輸入指定送貨時間");
    expect(validateDeliveryTimeSelection({
      deliveryDate: "",
      deliveryTime: "上午 10 時前",
      deliveryTimeMode: "specified",
      deliverySlotId: undefined,
      slots: [],
    })).toBe("請先選擇送貨日期");
  });

  it.each([
    ["inactive", []],
    ["renamed", [{ ...slot, displayLabel: "更新後 09:00-13:00" }]],
  ] as const)("allows an immutable pending slot snapshot after the slot is %s", (_, slots) => {
    expect(validateDeliveryTimeSelection({
      deliveryDate: "2026-07-17",
      deliveryTime: slot.displayLabel,
      deliveryTimeMode: "slot",
      deliverySlotId: slot.id,
      slots,
      frozenSlotSelection: { slotId: slot.id, snapshot: slot.displayLabel },
    })).toBeNull();
  });

  it("does not accept a changed value merely because a frozen selection exists", () => {
    expect(validateDeliveryTimeSelection({
      deliveryDate: "2026-07-17",
      deliveryTime: "edited snapshot",
      deliveryTimeMode: "slot",
      deliverySlotId: slot.id,
      slots: [{ ...slot, displayLabel: "更新後 09:00-13:00" }],
      frozenSlotSelection: { slotId: slot.id, snapshot: slot.displayLabel },
    })).toContain("內容已更新");
  });
});
