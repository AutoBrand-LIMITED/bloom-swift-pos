import { describe, expect, it } from "vitest";

import {
  mergeAddressHierarchy,
  parseDeliveryAddress,
  resolveHongKongAddressHierarchy,
  type PlainGoogleAddressComponent,
} from "@/lib/hk-address";

const component = (
  longText: string,
  types: string[],
  shortText = longText,
): PlainGoogleAddressComponent => ({ longText, shortText, types });

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

describe("resolveHongKongAddressHierarchy", () => {
  it("resolves the reported Kwun Tong components to the canonical hierarchy", () => {
    expect(resolveHongKongAddressHierarchy([
      component("香港", ["country"]),
      component("九龍", ["administrative_area_level_1"]),
      component("觀塘區", ["administrative_area_level_2"]),
      component("觀塘", ["political", "neighborhood"]),
    ])).toEqual({
      region: "九龍",
      district: "觀塘區",
      area: "觀塘",
    });
  });

  it("derives canonical parents from an exact recognised area", () => {
    expect(resolveHongKongAddressHierarchy([
      component("觀塘", ["sublocality_level_1"]),
    ])).toEqual({
      region: "九龍",
      district: "觀塘區",
      area: "觀塘",
    });
  });

  it("derives the region from an exact recognised district", () => {
    expect(resolveHongKongAddressHierarchy([
      component("觀塘區", ["administrative_area_level_2"]),
    ])).toEqual({
      region: "九龍",
      district: "觀塘區",
      area: "",
    });
  });

  it("accepts Hong Kong districts returned as sublocalities", () => {
    expect(resolveHongKongAddressHierarchy([
      component("觀塘區", ["sublocality_level_1"]),
    ])).toEqual({
      region: "九龍",
      district: "觀塘區",
      area: "",
    });
  });

  it("accepts a canonical region returned as a locality", () => {
    expect(resolveHongKongAddressHierarchy([
      component("九龍", ["locality"]),
    ])).toEqual({
      region: "九龍",
      district: "",
      area: "",
    });
  });

  it("uses a canonical short text when the long text is unknown", () => {
    expect(resolveHongKongAddressHierarchy([
      component("Kwun Tong", ["neighborhood"], "觀塘"),
    ])).toEqual({
      region: "九龍",
      district: "觀塘區",
      area: "觀塘",
    });
  });

  it("does not infer an area from street text or substrings", () => {
    expect(resolveHongKongAddressHierarchy([
      component("大埔道", ["route"]),
      component("大埔", ["route"]),
      component("九龍", ["administrative_area_level_1"]),
    ])).toEqual({
      region: "九龍",
      district: "",
      area: "",
    });
  });

  it("does not treat a country component as the Hong Kong Island region", () => {
    expect(resolveHongKongAddressHierarchy([
      component("香港島", ["country"]),
    ])).toEqual({
      region: "",
      district: "",
      area: "",
    });
  });

  it("returns an unresolved hierarchy for missing or unknown components", () => {
    expect(resolveHongKongAddressHierarchy([])).toEqual({
      region: "",
      district: "",
      area: "",
    });
    expect(resolveHongKongAddressHierarchy([
      component("Macau", ["country"]),
    ])).toEqual({
      region: "",
      district: "",
      area: "",
    });
  });
});

describe("mergeAddressHierarchy", () => {
  it("retains a complete valid manual hierarchy when Google is unresolved", () => {
    expect(mergeAddressHierarchy(
      { region: "", district: "", area: "" },
      { region: "九龍", district: "觀塘區", area: "九龍灣" },
    )).toEqual({
      region: "九龍",
      district: "觀塘區",
      area: "九龍灣",
    });
  });

  it("retains a compatible area when only the district is detected", () => {
    expect(mergeAddressHierarchy(
      { region: "九龍", district: "觀塘區", area: "" },
      { region: "九龍", district: "觀塘區", area: "九龍灣" },
    )).toEqual({
      region: "九龍",
      district: "觀塘區",
      area: "九龍灣",
    });
  });

  it("clears stale children that are invalid under a detected parent", () => {
    expect(mergeAddressHierarchy(
      { region: "九龍", district: "觀塘區", area: "" },
      { region: "香港島", district: "中西區", area: "中環" },
    )).toEqual({
      region: "九龍",
      district: "觀塘區",
      area: "",
    });
  });

  it("clears an internally inconsistent current hierarchy", () => {
    expect(mergeAddressHierarchy(
      { region: "", district: "", area: "" },
      { region: "九龍", district: "中西區", area: "中環" },
    )).toEqual({
      region: "九龍",
      district: "",
      area: "",
    });
  });

  it("canonicalises and derives parents from a detected area", () => {
    expect(mergeAddressHierarchy(
      { region: "", district: "", area: "觀塘" },
      { region: "香港島", district: "中西區", area: "中環" },
    )).toEqual({
      region: "九龍",
      district: "觀塘區",
      area: "觀塘",
    });
  });
});
