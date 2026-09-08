import { describe, expect, it } from "vitest";

import { formatDayEndMoney } from "@/lib/day-end";

describe("day-end currency formatting", () => {
  it("shows Hong Kong dollar reconciliation without decimal places", () => {
    expect(formatDayEndMoney(1112)).toContain("1,112");
    expect(formatDayEndMoney(275.5)).toContain("276");
    expect(formatDayEndMoney(0)).toContain("0");
  });
});
