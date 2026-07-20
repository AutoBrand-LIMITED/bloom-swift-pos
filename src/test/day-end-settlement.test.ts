import { describe, expect, it } from "vitest";

import { formatDayEndMoney } from "@/lib/day-end";

describe("day-end currency formatting", () => {
  it("always shows two decimal places for Hong Kong dollar reconciliation", () => {
    expect(formatDayEndMoney(1112)).toContain("1,112.00");
    expect(formatDayEndMoney(275.5)).toContain("275.50");
    expect(formatDayEndMoney(0)).toContain("0.00");
  });
});
