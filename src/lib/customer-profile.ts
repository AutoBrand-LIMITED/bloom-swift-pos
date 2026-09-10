import { canonicalPhoneValue } from "@/lib/phone-utils";

export const WALK_IN_CUSTOMER_CODE = "WALK-IN";
export const WALK_IN_CUSTOMER_NAME = "Walk-in Customer";

export type CustomerResolutionPhase =
  | "idle"
  | "debouncing"
  | "searching"
  | "matches"
  | "no_match"
  | "error"
  | "confirmed";

export interface CustomerResolutionState {
  phase: CustomerResolutionPhase;
  identityKey: string;
}

export function customerResolutionIdentityKey(phone: string, name: string): string {
  const normalizedPhone = canonicalPhoneValue(phone);
  const normalizedName = name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return normalizedName
    ? `${normalizedPhone || "no-phone"}|${normalizedName}`
    : "";
}

export interface CustomerProfileDraft {
  customerType: "personal" | "company";
  companyName: string;
  customerEmail: string;
  billingAddress: string;
}

export function detachedCustomerProfile(): CustomerProfileDraft {
  return {
    customerType: "personal",
    companyName: "",
    customerEmail: "",
    billingAddress: "",
  };
}

export function companyFieldsForCustomerType(
  customerType: CustomerProfileDraft["customerType"],
  companyName: string,
  billingAddress: string,
): Pick<CustomerProfileDraft, "customerType" | "companyName" | "billingAddress"> {
  return customerType === "company"
    ? { customerType, companyName, billingAddress }
    : { customerType, companyName: "", billingAddress: "" };
}
