import { describe, expect, it } from "vitest";

import { checkoutBarLeftOffset } from "@/lib/pos-layout";

describe("checkoutBarLeftOffset", () => {
  it("uses the full customer panel width while history is open", () => {
    expect(checkoutBarLeftOffset(true, true)).toBe("min(360px, 85vw)");
  });

  it("shrinks to the left rail width when customer history is collapsed", () => {
    expect(checkoutBarLeftOffset(true, false)).toBe("3.5rem");
  });

  it("uses the full viewport when no customer is selected", () => {
    expect(checkoutBarLeftOffset(false, false)).toBe(0);
  });
});
