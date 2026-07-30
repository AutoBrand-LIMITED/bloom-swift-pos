import { describe, expect, it } from "vitest";

import {
  companyFieldsForCustomerType,
  detachedCustomerProfile,
} from "@/lib/customer-profile";

describe("customer profile binding", () => {
  it("clears all source-bound profile fields after a selected customer is detached", () => {
    expect(detachedCustomerProfile()).toEqual({
      customerType: "personal",
      companyName: "",
      customerEmail: "",
      billingAddress: "",
    });
  });

  it("does not retain hidden company data when changing to a personal customer", () => {
    expect(companyFieldsForCustomerType(
      "personal",
      "Previous Customer Limited",
      "1 Previous Street",
    )).toEqual({
      customerType: "personal",
      companyName: "",
      billingAddress: "",
    });
  });
});
