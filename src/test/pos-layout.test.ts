import { describe, expect, it } from "vitest";

import { mobileCheckoutBarClassName } from "@/lib/pos-layout";

describe("mobileCheckoutBarClassName", () => {
  it("keeps the mobile and iPad checkout bar full width below the xl breakpoint", () => {
    expect(mobileCheckoutBarClassName).toContain("left-0");
    expect(mobileCheckoutBarClassName).toContain("right-0");
    expect(mobileCheckoutBarClassName).toContain("xl:hidden");
    expect(mobileCheckoutBarClassName).not.toContain("--checkout-bar-left");
  });
});
