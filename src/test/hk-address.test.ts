import { describe, expect, it } from "vitest";

import { parseDeliveryAddress } from "@/lib/hk-address";

describe("parseDeliveryAddress", () => {
  it("splits a recognised Hong Kong hierarchy", () => {
    expect(parseDeliveryAddress("香港島 中西區 中環 Printing House 20/F")).toEqual({
      region: "香港島",
      district: "中西區",
      area: "中環",
      detail: "Printing House 20/F",
    });
  });

  it("collapses prefixes duplicated by the old address reuse behavior", () => {
    expect(parseDeliveryAddress(
      "香港島 中西區 中環 香港島 中西區 西營盤 巧運工業大廈4樓A室 B08",
    )).toEqual({
      region: "香港島",
      district: "中西區",
      area: "西營盤",
      detail: "巧運工業大廈4樓A室 B08",
    });
  });

  it("keeps an unknown address intact instead of guessing", () => {
    expect(parseDeliveryAddress("Macau Avenida da Praia Grande 123")).toEqual({
      region: "",
      district: "",
      area: "",
      detail: "Macau Avenida da Praia Grande 123",
    });
  });

  it("supports a recognised partial prefix", () => {
    expect(parseDeliveryAddress("九龍 觀塘區 Industrial Centre 8/F")).toEqual({
      region: "九龍",
      district: "觀塘區",
      area: "",
      detail: "Industrial Centre 8/F",
    });
  });
});
