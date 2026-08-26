import { describe, expect, it } from "vitest";

import { checkoutBarLeftOffset, mobileCheckoutBarClassName } from "@/lib/pos-layout";

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

  it("keeps the 361px mobile checkout bar full width before the lg breakpoint", () => {
    expect(mobileCheckoutBarClassName).toContain("left-0");
    expect(mobileCheckoutBarClassName).toContain("right-0");
    expect(mobileCheckoutBarClassName).toContain("lg:left-[var(--checkout-bar-left)]");
  });
});
