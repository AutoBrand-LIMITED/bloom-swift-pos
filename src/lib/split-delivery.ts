import { isValidDeliveryDate, isValidPhoneNumber } from "@/lib/checkout-validation";
import type { DeliverySplit, OrderItem } from "@/types/order";

export const validateDeliverySplits = (
  splits: readonly DeliverySplit[],
  items: readonly OrderItem[],
): string | null => {
  if (splits.length > 10) return "每張訂單最多可加 10 個額外送貨點。";
  const itemQuantities = new Map(items.map((item) => [item.id, item.quantity]));
  const allocated = new Map<string, number>();

  for (let index = 0; index < splits.length; index += 1) {
    const split = splits[index];
    const label = `拆單送貨點 ${index + 2}`;
    if (!isValidDeliveryDate(split.deliveryDate)) return `${label}請選擇有效送貨日期。`;
    if (!split.deliveryTimeMode || !split.deliveryTime.trim()) return `${label}請選擇送貨時間。`;
    if (split.deliveryTimeMode === "slot" && !split.deliverySlotId) return `${label}請重新選擇標準時段。`;
    if (!split.deliveryAddress.trim()) return `${label}請輸入送貨地址。`;
    if (!split.recipientName.trim()) return `${label}請輸入收貨人名稱。`;
    if (!isValidPhoneNumber(split.recipientPhone)) return `${label}請輸入有效收貨人電話。`;
    if (split.recipientType === "company" && !split.recipientCompanyName.trim()) {
      return `${label}請輸入收貨公司名稱。`;
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
