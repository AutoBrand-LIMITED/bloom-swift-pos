import { describe, expect, it } from "vitest";

import {
  canonicalPhoneValue,
  isValidSupportedPhone,
  parsePhoneValue,
  phoneMatchesQuery,
  phoneSearchQueryKey,
  samePhoneNumber,
} from "@/lib/phone-utils";

describe("international phone handling", () => {
  it("keeps legacy Hong Kong numbers compatible while producing an E.164 identity", () => {
    expect(canonicalPhoneValue("9123 4567")).toBe("+85291234567");
    expect(isValidSupportedPhone("9123-4567")).toBe(true);
  });

  it("recognizes Singapore and Canadian numbers with plus or 00 prefixes", () => {
    expect(parsePhoneValue("+65 8123 4567")).toMatchObject({
      region: "SG",
      localNumber: "81234567",
    });
    expect(canonicalPhoneValue("0065 8123 4567")).toBe("+6581234567");
    expect(canonicalPhoneValue("+1 (416) 555-0123")).toBe("+14165550123");
  });

  it("searches by full international or local digits", () => {
    expect(phoneSearchQueryKey("+65 8123 4567")).toBe("+6581234567");
    expect(phoneSearchQueryKey("0065 8123 4567")).toBe("+6581234567");
    expect(phoneSearchQueryKey("9123 4567")).toBe("91234567");
    expect(phoneMatchesQuery("+65 8123 4567", "+65 8123")).toBe(true);
    expect(phoneMatchesQuery("+65 8123 4567", "8123")).toBe(true);
    expect(phoneMatchesQuery("+1 (416) 555-0123", "416555")).toBe(true);
    expect(phoneMatchesQuery("+852 8123 4567", "+65 8123")).toBe(false);
  });

  it("keeps identical local numbers in different countries distinct", () => {
    expect(samePhoneNumber("+852 8123 4567", "+65 8123 4567")).toBe(false);
  });

  it("rejects incomplete and impossible numbers", () => {
    expect(isValidSupportedPhone("+65 8123")).toBe(false);
    expect(isValidSupportedPhone("+1 123")).toBe(false);
  });
});
