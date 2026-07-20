import type { DeliverySlot } from "@/lib/odoo-api";
import type { DeliveryTimeMode } from "@/types/order";

export const DEMO_DELIVERY_SLOTS: DeliverySlot[] = [
  {
    id: -1,
    displayLabel: "上午 09:00-13:00",
    startTime: "09:00",
    endTime: "13:00",
  },
  {
    id: -2,
    displayLabel: "下午 13:00-18:00",
    startTime: "13:00",
    endTime: "18:00",
  },
];

export function deliverySlotSnapshot(slot: DeliverySlot): string {
  return slot.displayLabel.trim() || `${slot.startTime}-${slot.endTime}`;
}

export function findDeliverySlot(
  slots: readonly DeliverySlot[],
  slotId: number | undefined,
): DeliverySlot | undefined {
  if (slotId === undefined) return undefined;
  return slots.find((slot) => slot.id === slotId);
}

export interface FrozenDeliverySlotSelection {
  slotId: number;
  snapshot: string;
}

interface DeliveryTimeSelection {
  deliveryDate: string;
  deliveryTime: string;
  deliveryTimeMode: DeliveryTimeMode | undefined;
  deliverySlotId: number | undefined;
  slots: readonly DeliverySlot[];
  frozenSlotSelection?: FrozenDeliverySlotSelection;
}

export function validateDeliveryTimeSelection({
  deliveryDate,
  deliveryTime,
  deliveryTimeMode,
  deliverySlotId,
  slots,
  frozenSlotSelection,
}: DeliveryTimeSelection): string | null {
  if (!deliveryTimeMode) {
    return deliverySlotId === undefined ? null : "請重新選擇送貨時段";
  }
  if (!deliveryDate) return "請先選擇送貨日期";

  if (deliveryTimeMode === "specified") {
    if (deliverySlotId !== undefined) return "指定時間不可連同標準時段送出";
    const specifiedTime = deliveryTime.trim();
    if (!specifiedTime) return "請輸入指定送貨時間";
    if (specifiedTime.length > 120) return "指定送貨時間不可多於 120 個字";
    return null;
  }

  if (deliverySlotId === undefined) return "請選擇標準送貨時段";
  const matchesFrozenSelection = frozenSlotSelection?.slotId === deliverySlotId
    && Boolean(frozenSlotSelection.snapshot.trim())
    && frozenSlotSelection.snapshot === deliveryTime;
  const selectedSlot = findDeliverySlot(slots, deliverySlotId);
  if (!selectedSlot) {
    return matchesFrozenSelection
      ? null
      : "所選時段已不可用，請重新載入後再選擇";
  }
  if (deliveryTime !== deliverySlotSnapshot(selectedSlot)) {
    return matchesFrozenSelection ? null : "送貨時段內容已更新，請重新選擇";
  }
  return null;
}
