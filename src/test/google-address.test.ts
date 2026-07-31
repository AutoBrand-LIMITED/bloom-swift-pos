import { describe, expect, it } from "vitest";

import { publicGoogleAddressQuery } from "@/lib/google-address";

describe("publicGoogleAddressQuery", () => {
  it.each([
    "G/F",
    "LG/F",
    "UG/F",
    "M/F",
    "B1/F",
    "20/F",
    "20F",
    "地下",
    "地下 A舖",
    "A舖",
    "八樓",
    "A單位",
    "Room 08",
    "Unit B08",
    "Shop G01",
    "Ground Floor",
  ])("removes private premise suffix %s", (suffix) => {
    expect(publicGoogleAddressQuery(`巧運工業大廈 ${suffix}`)).toBe("巧運工業大廈");
  });

  it.each(["4", "B", "B08"])(
    "does not send an unfinished trailing premise fragment %s",
    (suffix) => {
      expect(publicGoogleAddressQuery(`巧運工業大廈 ${suffix}`)).toBe("巧運工業大廈");
    },
  );

  it("keeps a public street and building query unchanged", () => {
    expect(publicGoogleAddressQuery("6 巧明街 巧運工業大廈")).toBe(
      "6 巧明街 巧運工業大廈",
    );
  });

  it.each([
    "Tower 3",
    "Block B",
    "Phase 13",
    "Village House 28",
    "House No. 6",
  ])("keeps public terminal identifier %s", (address) => {
    expect(publicGoogleAddressQuery(address)).toBe(address);
  });
});
