import { isValidDeliveryDate, isValidPhoneNumber } from "@/lib/checkout-validation";
import { PICKUP_LOCATION_ADDRESS } from "@/lib/fulfillment";
import type { DeliverySplit, OrderItem } from "@/types/order";

export const splitFulfillmentType = (split: DeliverySplit) => (
  split.fulfillmentType || "delivery"
);

export const normalizeDeliverySplitsForSubmission = (
  splits: readonly DeliverySplit[],
): DeliverySplit[] => splits.map((split) => {
  if (splitFulfillmentType(split) === "delivery") {
    return { ...split, fulfillmentType: "delivery" };
  }
  return {
    ...split,
    fulfillmentType: "pickup",
    deliveryRegion: "",
    deliveryDistrict: "",
    deliveryArea: "",
    deliveryDetail: "",
    deliveryAddress: PICKUP_LOCATION_ADDRESS,
    deliveryGoogleAddress: "",
    deliveryBuilding: "",
    deliveryFloor: "",
    deliveryUnit: "",
    recipientType: "personal",
    recipientCompanyName: "",
    recipientName: "",
    recipientPhone: "",
    deliveryPerson: "",
    failedDeliveryAction: "none",
    deliveryNote: "",
  };
});

export const normalizeDeliverySplitsForOperationalUpdate = (
  splits: readonly DeliverySplit[],
): DeliverySplit[] => splits.map((split) => ({
  ...split,
  fulfillmentType: splitFulfillmentType(split),
  deliveryAddress: splitFulfillmentType(split) === "pickup"
    ? split.deliveryAddress.trim() || PICKUP_LOCATION_ADDRESS
    : split.deliveryAddress.trim(),
  itemAllocations: split.itemAllocations.map((allocation) => ({ ...allocation })),
}));

export const operationalSplitIdentityIsUnchanged = (
  original: readonly DeliverySplit[],
  edited: readonly DeliverySplit[],
): boolean => original.length === edited.length && original.every((split, index) => {
  const candidate = edited[index];
  if (!candidate || candidate.id !== split.id) return false;
  if (candidate.itemAllocations.length !== split.itemAllocations.length) return false;
  return split.itemAllocations.every((allocation, allocationIndex) => {
    const candidateAllocation = candidate.itemAllocations[allocationIndex];
    return Boolean(
      candidateAllocation
      && candidateAllocation.itemId === allocation.itemId
      && candidateAllocation.itemName === allocation.itemName
      && candidateAllocation.quantity === allocation.quantity,
    );
  });
});

export const validateOperationalDeliverySplits = (
  splits: readonly DeliverySplit[],
): string | null => {
  if (splits.length > 10) return "每張訂單最多可編輯 10 個額外收貨點。";
  for (let index = 0; index < splits.length; index += 1) {
    const split = splits[index];
    const label = `額外收貨點 ${index + 2}`;
    if (!split.id.trim()) return `${label}識別資料無效。`;
    if (!isValidDeliveryDate(split.deliveryDate)) return `${label}請選擇有效日期。`;
    if (!split.deliveryTimeMode || !split.deliveryTime.trim()) return `${label}請選擇時間。`;
    if (split.deliveryTimeMode === "slot" && !split.deliverySlotId) {
      return `${label}請重新選擇標準時段。`;
    }
    if (split.deliveryTimeMode === "specified" && split.deliverySlotId) {
      return `${label}指定時間不可保留標準時段。`;
    }
    if (splitFulfillmentType(split) === "delivery") {
      if (!split.deliveryAddress.trim()) return `${label}請輸入送貨地址。`;
      if (!split.recipientName.trim()) return `${label}請輸入收貨人名稱。`;
      if (!isValidPhoneNumber(split.recipientPhone)) return `${label}請輸入有效收貨人電話。`;
      if (split.recipientType === "company" && !split.recipientCompanyName.trim()) {
        return `${label}請輸入收貨公司名稱。`;
      }
    } else if (split.recipientPhone.trim() && !isValidPhoneNumber(split.recipientPhone)) {
      return `${label}請輸入有效聯絡電話。`;
    }
    if (split.itemAllocations.length === 0 || split.itemAllocations.some(
      (allocation) => !allocation.itemId || !allocation.itemName || !Number.isInteger(allocation.quantity) || allocation.quantity <= 0,
    )) {
      return `${label}商品分配資料無效。`;
    }
  }
  return null;
};

export const validateDeliverySplits = (
  splits: readonly DeliverySplit[],
  items: readonly OrderItem[],
): string | null => {
  if (splits.length > 10) return "每張訂單最多可加 10 個額外收貨點。";
  const itemQuantities = new Map(items.map((item) => [item.id, item.quantity]));
  const allocated = new Map<string, number>();

  for (let index = 0; index < splits.length; index += 1) {
    const split = splits[index];
    const label = `拆單收貨點 ${index + 2}`;
    if (!isValidDeliveryDate(split.deliveryDate)) return `${label}請選擇有效送貨日期。`;
    if (!split.deliveryTimeMode || !split.deliveryTime.trim()) return `${label}請選擇送貨時間。`;
    if (split.deliveryTimeMode === "slot" && !split.deliverySlotId) return `${label}請重新選擇標準時段。`;
    if (splitFulfillmentType(split) === "delivery") {
      if (!split.deliveryAddress.trim()) return `${label}請輸入送貨地址。`;
      if (!split.recipientName.trim()) return `${label}請輸入收貨人名稱。`;
      if (!isValidPhoneNumber(split.recipientPhone)) return `${label}請輸入有效收貨人電話。`;
      if (split.recipientType === "company" && !split.recipientCompanyName.trim()) {
        return `${label}請輸入收貨公司名稱。`;
      }
    }
    const positiveAllocations = split.itemAllocations.filter((entry) => entry.quantity > 0);
    if (positiveAllocations.length === 0) return `${label}請至少分配一件商品。`;
    for (const entry of positiveAllocations) {
      const available = itemQuantities.get(entry.itemId);
      if (available === undefined || !Number.isInteger(entry.quantity)) {
        return `${label}商品分配資料無效。`;
      }
      const next = (allocated.get(entry.itemId) || 0) + entry.quantity;
      if (next > available) return "拆單商品數量超過原訂單數量。";
      allocated.set(entry.itemId, next);
    }
  }
  return null;
};
