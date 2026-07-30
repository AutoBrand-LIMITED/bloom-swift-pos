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
