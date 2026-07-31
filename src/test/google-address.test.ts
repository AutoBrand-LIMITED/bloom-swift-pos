import { describe, expect, it } from "vitest";

import {
  composeGooglePlaceAddress,
  publicGoogleAddressQuery,
} from "@/lib/google-address";

describe("composeGooglePlaceAddress", () => {
  it("preserves the selected place name when the formatted address omits it", () => {
    expect(
      composeGooglePlaceAddress("巧運工業大廈", "觀塘駿業街66號"),
    ).toBe("巧運工業大廈, 觀塘駿業街66號");
  });

  it("does not duplicate a place name already in the formatted address", () => {
    expect(
      composeGooglePlaceAddress(
        "巧運工業大廈",
        "巧運工業大廈, 觀塘駿業街66號",
      ),
    ).toBe("巧運工業大廈, 觀塘駿業街66號");
  });

  it("recognizes normalized Unicode, case, spacing, and separators", () => {
    expect(
      composeGooglePlaceAddress(
        "ＬＵＣＫＹ　ＩＮＤＵＳＴＲＩＡＬ－ＢＵＩＬＤＩＮＧ",
        "Lucky Industrial Building, 66 Tsun Yip Street",
      ),
    ).toBe("Lucky Industrial Building, 66 Tsun Yip Street");
  });

  it("does not treat a Latin substring as the complete place name", () => {
    expect(composeGooglePlaceAddress("One", "Stone Street")).toBe(
      "One, Stone Street",
    );
  });

  it("ignores apostrophes and periods that join Latin address words", () => {
    expect(
      composeGooglePlaceAddress(
        "King's Place",
        "Kings Place, St.John's Road",
      ),
    ).toBe("Kings Place, St.John's Road");
  });

  it.each([
    ["", " 觀塘駿業街66號 ", "觀塘駿業街66號"],
    [" 巧運工業大廈 ", "", "巧運工業大廈"],
    [" ", " ", ""],
  ])(
    "returns the non-empty trimmed value when either input is blank",
    (placeName, formattedAddress, expected) => {
      expect(composeGooglePlaceAddress(placeName, formattedAddress)).toBe(
        expected,
      );
    },
  );
});

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
