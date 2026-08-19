import { beforeEach, describe, expect, it } from "vitest";

import {
  loadCachedPaymentOptions,
  resolvePaymentReference,
  saveCachedPaymentOptions,
} from "@/lib/payment-options";

describe("payment option cache", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps the last known Odoo payment choices available", () => {
    const options = [
      { code: "cash", label: "Cash" },
      { code: "bank_in_fps", label: "Bank-in / FPS" },
    ];

    saveCachedPaymentOptions(options);

    expect(loadCachedPaymentOptions()).toEqual(options);
  });

  it("ignores corrupt or incomplete cached values", () => {
    window.localStorage.setItem(
      "florist-pos-payment-options-v1",
      JSON.stringify([{ code: "cash" }, null, { code: "card", label: "Card" }]),
    );

    expect(loadCachedPaymentOptions()).toEqual([{ code: "card", label: "Card" }]);
  });
});

describe("payment reference fallback", () => {
  it("keeps a reference entered by the cashier", () => {
    expect(resolvePaymentReference("  FPS-123  ", "43e81d2e-abcd")).toBe("FPS-123");
  });

  it("generates a stable POS reference when the cashier leaves it blank", () => {
    expect(resolvePaymentReference("", "43e81d2e-abcd")).toBe("POS-43E81D2E");
  });
});
