import type { OrderItem } from "@/types/order";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeDiscountPercent(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(100, Math.max(0, value || 0));
  return Math.round(clamped / 5) * 5;
}

export function normalizeFixedDiscount(value: number | undefined, gross?: number): number {
  if (!Number.isFinite(value)) return 0;
  const whole = Math.max(0, Math.round(value || 0));
  return gross === undefined ? whole : Math.min(whole, Math.max(0, gross));
}

export function orderItemTotal(item: OrderItem): number {
  const gross = item.price * item.quantity;
  if (item.discountType === "fixed") {
    return roundMoney(gross - normalizeFixedDiscount(item.discountAmount, gross));
  }
  const discountMultiplier = 1 - normalizeDiscountPercent(item.discountPercent) / 100;
  return roundMoney(gross * discountMultiplier);
}

export function orderItemsTotal(items: OrderItem[]): number {
  return roundMoney(items.reduce((sum, item) => sum + orderItemTotal(item), 0));
}

export function hasOrderLinePriceAdjustment(item: OrderItem): boolean {
  const hasDiscount = item.discountType === "fixed"
    ? normalizeFixedDiscount(item.discountAmount) > 0
    : normalizeDiscountPercent(item.discountPercent) > 0;
  const hasCatalogPriceOverride = item.productId !== undefined
    && item.catalogPrice !== undefined
    && roundMoney(item.price) !== roundMoney(item.catalogPrice);
  return hasDiscount || hasCatalogPriceOverride;
}

export function orderLineAdjustmentRequiresReason(item: OrderItem): boolean {
  const hasDiscount = item.discountType === "fixed"
    ? normalizeFixedDiscount(item.discountAmount) > 0
    : normalizeDiscountPercent(item.discountPercent) > 0;
  const hasReasonRequiredPriceOverride = item.fixedPrice !== false
    && item.productId !== undefined
    && item.catalogPrice !== undefined
    && roundMoney(item.price) !== roundMoney(item.catalogPrice);
  return hasDiscount || hasReasonRequiredPriceOverride;
}

export function orderLineAdjustmentNeedsReason(item: OrderItem): boolean {
  return orderLineAdjustmentRequiresReason(item) && !item.priceOverrideReason?.trim();
}
