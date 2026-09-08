import { describe, expect, it } from "vitest";

import {
  hasOrderLinePriceAdjustment,
  normalizeDiscountPercent,
  normalizeFixedDiscount,
  orderItemTotal,
  orderItemsTotal,
  orderLineAdjustmentNeedsReason,
} from "@/lib/order-pricing";
import type { OrderItem } from "@/types/order";

const item = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  id: "line-1",
  name: "Rose bouquet",
  price: 100,
  quantity: 2,
  productId: 4338,
  catalogPrice: 100,
  discountPercent: 0,
  priceOverrideReason: "",
  ...overrides,
});

describe("order line pricing", () => {
  it("applies an order-specific unit price and percentage discount", () => {
    expect(orderItemTotal(item({ price: 90, discountPercent: 10 }))).toBe(162);
    expect(orderItemsTotal([
      item({ price: 90, discountPercent: 10 }),
      item({ id: "line-2", price: 50, quantity: 1, productId: undefined, catalogPrice: undefined }),
    ])).toBe(212);
  });

  it("requires a reason for either a catalog price override or a discount", () => {
    expect(hasOrderLinePriceAdjustment(item({ price: 90 }))).toBe(true);
    expect(orderLineAdjustmentNeedsReason(item({ price: 90 }))).toBe(true);
    expect(orderLineAdjustmentNeedsReason(item({ discountPercent: 5 }))).toBe(true);
    expect(orderLineAdjustmentNeedsReason(item({ price: 90, priceOverrideReason: "VIP" }))).toBe(false);
  });

  it("does not treat the normal catalog price as an override", () => {
    expect(hasOrderLinePriceAdjustment(item())).toBe(false);
    expect(orderItemTotal(item())).toBe(200);
  });

  it("uses whole five-percent steps and supports a mutually exclusive fixed discount", () => {
    expect(normalizeDiscountPercent(2.5)).toBe(5);
    expect(normalizeDiscountPercent(17)).toBe(15);
    expect(normalizeFixedDiscount(10.6, 200)).toBe(11);
    expect(orderItemTotal(item({
      discountType: "fixed",
      discountPercent: 0,
      discountAmount: 25,
      priceOverrideReason: "Manager discount",
    }))).toBe(175);
  });
});
