import { describe, expect, it } from "vitest";

import {
  isValidDeliveryDate,
  isValidPhoneNumber,
  validatePositiveOrderTotal,
  validateCheckout,
} from "@/lib/checkout-validation";
import type { DeliverySlot } from "@/lib/odoo-api";

const slots: DeliverySlot[] = [
  { id: 11, displayLabel: "上午 09:00-13:00", startTime: "09:00", endTime: "13:00" },
];

const validCheckout = {
  customerName: "陳小姐",
  customerType: "personal" as const,
  companyName: "",
  customerEmail: "",
  billingAddress: "",
  phone: "9123 4567",
  senderName: "陳小姐",
  recipientType: "personal" as const,
  recipientCompanyName: "",
  recipientName: "李先生",
  recipientPhone: "+853 6123-4567",
  deliveryAddress: "香港 中環 皇后大道中 1 號",
  deliveryDate: "2026-07-30",
  deliveryTime: "上午 09:00-13:00",
  deliveryTimeMode: "slot" as const,
  deliverySlotId: 11,
  deliverySlots: slots,
};

describe("checkout phone validation", () => {
  it.each([
    "91234567",
    "9123 4567",
    "2871-2345",
    "(2871) 2345",
    "852 9123 4567",
    "853-6123-4567",
    "+852 9123 4567",
    "+853 (6123) 4567",
    "+44 20 7946 0958",
  ])("accepts supported phone format %s", (phone) => {
    expect(isValidPhoneNumber(phone)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "1234567",
    "123456789",
    "85191234567",
    "+1234567",
    "+1234567890123456",
    "9123ABC",
    "852+91234567",
    "++85291234567",
    "+852.9123.4567",
  ])("rejects unsupported phone format %s", (phone) => {
    expect(isValidPhoneNumber(phone)).toBe(false);
  });
});

describe("checkout required-field validation", () => {
  it("returns every missing-field error in one result", () => {
    const errors = validateCheckout({
      ...validCheckout,
      customerName: " ",
      phone: "",
      senderName: "",
      recipientName: "",
      recipientPhone: "abc",
      deliveryAddress: "",
      deliveryDate: "",
      deliveryTime: "",
      deliveryTimeMode: undefined,
      deliverySlotId: undefined,
    });

    expect(Object.keys(errors)).toEqual([
      "customerName",
      "phone",
      "senderName",
      "recipientName",
      "recipientPhone",
      "deliveryAddress",
      "deliveryDate",
      "deliveryTime",
    ]);
  });

  it("accepts complete slot and specified-time checkouts", () => {
    expect(validateCheckout(validCheckout)).toEqual({});
    expect(validateCheckout({
      ...validCheckout,
      deliveryTimeMode: "specified",
      deliverySlotId: undefined,
      deliveryTime: "上午 10 時前",
    })).toEqual({});
  });

  it("requires company name and billing address only for company customers", () => {
    const companyErrors = validateCheckout({
      ...validCheckout,
      customerType: "company",
      companyName: " ",
      billingAddress: "",
    });
    expect(companyErrors.companyName).toBe("公司客戶必須輸入公司名稱");
    expect(companyErrors.billingAddress).toBe("公司客戶必須輸入帳單地址");

    expect(validateCheckout({
      ...validCheckout,
      customerType: "company",
      companyName: "中西花店有限公司",
      billingAddress: "香港中環花園道 1 號",
      customerEmail: " accounts@example.com ",
    })).toEqual({});
    expect(validateCheckout({
      ...validCheckout,
      customerEmail: "not-an-email",
    }).customerEmail).toBe("請輸入有效電郵地址");
  });

  it("requires a company name and contact for company recipients", () => {
    const missingCompany = validateCheckout({
      ...validCheckout,
      recipientType: "company",
      recipientCompanyName: " ",
    });
    expect(missingCompany.recipientCompanyName).toBe("公司收貨人必須輸入公司名稱");

    const missingContact = validateCheckout({
      ...validCheckout,
      recipientType: "company",
      recipientCompanyName: "Company Recipient Limited",
      recipientName: " ",
    });
    expect(missingContact.recipientName).toBe("請輸入收花人姓名");

    expect(validateCheckout({
      ...validCheckout,
      recipientType: "company",
      recipientCompanyName: "Company Recipient Limited",
    })).toEqual({});
  });

  it("allows only a restored legacy company snapshot to replay without new company fields", () => {
    expect(validateCheckout({
      ...validCheckout,
      customerType: "company",
      companyName: "舊公司訂單",
      billingAddress: "",
      allowLegacyMissingCompanyFields: true,
      restoredPendingSubmission: true,
    })).toEqual({});

    expect(validateCheckout({
      ...validCheckout,
      customerType: "company",
      companyName: "舊公司訂單",
      billingAddress: "",
    }).billingAddress).toBe("公司客戶必須輸入帳單地址");
  });

  it("preserves stale-slot validation", () => {
    expect(validateCheckout({
      ...validCheckout,
      deliveryTime: "已停用時段",
      deliverySlotId: 99,
    }).deliveryTime).toBe("所選時段已不可用，請重新載入後再選擇");
  });

  it("requires an exact real calendar date", () => {
    expect(isValidDeliveryDate("2026-02-28")).toBe(true);
    expect(isValidDeliveryDate("2026-02-30")).toBe(false);
    expect(isValidDeliveryDate("2026/02/28")).toBe(false);
  });

  it("requires an Odoo customer selection or explicit new-customer confirmation", () => {
    expect(validateCheckout({
      ...validCheckout,
      requiresCustomerResolution: true,
    }).phone).toBe("請先搜尋並選擇現有客戶，或確認新增客戶");

    expect(validateCheckout({
      ...validCheckout,
      requiresCustomerResolution: true,
      selectedCustomerPhone: "91234567",
    })).toEqual({});

    expect(validateCheckout({
      ...validCheckout,
      requiresCustomerResolution: true,
      confirmedNewCustomerPhone: "91234567",
    })).toEqual({});
  });

  it("invalidates a selected or confirmed customer when the normalized phone changes", () => {
    expect(validateCheckout({
      ...validCheckout,
      phone: "9123 4568",
      requiresCustomerResolution: true,
      selectedCustomerPhone: "9123 4567",
      confirmedNewCustomerPhone: "91234567",
    }).phone).toBe("請先搜尋並選擇現有客戶，或確認新增客戶");
  });

  it("allows restored pending submissions and local demo checkouts", () => {
    expect(validateCheckout({
      ...validCheckout,
      requiresCustomerResolution: true,
      restoredPendingSubmission: true,
    })).toEqual({});

    expect(validateCheckout({
      ...validCheckout,
      requiresCustomerResolution: false,
    })).toEqual({});
  });

  it("requires customer resolution again after a restored pending submission is cleared", () => {
    const restoredErrors = validateCheckout({
      ...validCheckout,
      requiresCustomerResolution: true,
      restoredPendingSubmission: true,
    });
    expect(restoredErrors).toEqual({});

    const nextOrderErrors = validateCheckout({
      ...validCheckout,
      requiresCustomerResolution: true,
      restoredPendingSubmission: false,
    });
    expect(nextOrderErrors.phone).toBe("請先搜尋並選擇現有客戶，或確認新增客戶");
  });
});

describe("checkout total validation", () => {
  it("blocks zero and negative computed totals before submission", () => {
    expect(validatePositiveOrderTotal(0)).toBe(
      "訂單總額必須大過 $0，請調整商品、附加費或折扣後再提交",
    );
    expect(validatePositiveOrderTotal(-0.01)).not.toBeNull();
    expect(validatePositiveOrderTotal(0.01)).toBeNull();
  });
});
