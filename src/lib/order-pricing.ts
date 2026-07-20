import type { OrderItem } from "@/types/order";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeDiscountPercent(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value || 0));
}

export function orderItemTotal(item: OrderItem): number {
  const discountMultiplier = 1 - normalizeDiscountPercent(item.discountPercent) / 100;
  return roundMoney(item.price * item.quantity * discountMultiplier);
}

export function orderItemsTotal(items: OrderItem[]): number {
  return roundMoney(items.reduce((sum, item) => sum + orderItemTotal(item), 0));
}

export function hasOrderLinePriceAdjustment(item: OrderItem): boolean {
  const hasDiscount = normalizeDiscountPercent(item.discountPercent) > 0;
  const hasCatalogPriceOverride = item.productId !== undefined
    && item.catalogPrice !== undefined
    && roundMoney(item.price) !== roundMoney(item.catalogPrice);
  return hasDiscount || hasCatalogPriceOverride;
}

export function orderLineAdjustmentNeedsReason(item: OrderItem): boolean {
  return hasOrderLinePriceAdjustment(item) && !item.priceOverrideReason?.trim();
}
