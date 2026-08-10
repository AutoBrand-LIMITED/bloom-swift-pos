import {
  validateDeliveryTimeSelection,
  type FrozenDeliverySlotSelection,
} from "@/lib/delivery-slots";
import type { DeliverySlot } from "@/lib/odoo-api";
import type { DeliveryTimeMode, RecipientType } from "@/types/order";

export type CheckoutField =
  | "customerName"
  | "phone"
  | "senderName"
  | "companyName"
  | "customerEmail"
  | "billingAddress"
  | "recipientCompanyName"
  | "recipientName"
  | "recipientPhone"
  | "deliveryAddress"
  | "deliveryDate"
  | "deliveryTime";

export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

interface CheckoutValidationInput {
  customerName: string;
  customerType: "personal" | "company";
  companyName: string;
  customerEmail: string;
  billingAddress: string;
  allowLegacyMissingCompanyFields?: boolean;
  phone: string;
  selectedCustomerName?: string;
  selectedCustomerPhone?: string;
  confirmedNewCustomerName?: string | null;
  confirmedNewCustomerPhone?: string | null;
  restoredPendingSubmission?: boolean;
  requiresCustomerResolution?: boolean;
  senderName: string;
  recipientType: RecipientType;
  recipientCompanyName: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryDate: string;
  deliveryTime: string;
  deliveryTimeMode?: DeliveryTimeMode;
  deliverySlotId?: number;
  deliverySlots: readonly DeliverySlot[];
  frozenSlotSelection?: FrozenDeliverySlotSelection;
}

const ALLOWED_PHONE_CHARACTERS = /^\+?[0-9 ()-]+$/;
const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeCustomerIdentityName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function isValidPhoneNumber(value: string): boolean {
  const phone = value.trim();
  if (!phone || !ALLOWED_PHONE_CHARACTERS.test(phone)) return false;

  const digits = normalizePhoneNumber(phone);
  if (phone.startsWith("+")) return digits.length >= 8 && digits.length <= 15;
  return digits.length === 8
    || (digits.length === 11 && (digits.startsWith("852") || digits.startsWith("853")));
}

export function isValidDeliveryDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function isValidEmailAddress(value: string): boolean {
  const email = value.trim();
  return !email || (email.length <= 254 && email.includes("@"));
}

export function validatePositiveOrderTotal(finalPrice: number): string | null {
  return Number.isFinite(finalPrice) && finalPrice > 0
    ? null
    : "訂單總額必須大過 $0，請調整商品、附加費或折扣後再提交";
}

export function validateCheckout(input: CheckoutValidationInput): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (!input.customerName.trim()) errors.customerName = "請輸入下單人／聯絡人名稱";
  if (input.customerType === "company" && !input.allowLegacyMissingCompanyFields) {
    if (!input.companyName.trim()) errors.companyName = "公司客戶必須輸入公司名稱";
    if (!input.billingAddress.trim()) errors.billingAddress = "公司客戶必須輸入帳單地址";
  }
  if (!isValidEmailAddress(input.customerEmail)) {
    errors.customerEmail = "請輸入有效電郵地址";
  }
  if (!input.phone.trim()) {
    errors.phone = "請輸入下單人電話";
  } else if (!isValidPhoneNumber(input.phone)) {
    errors.phone = "請輸入有效電話號碼";
  } else if (input.requiresCustomerResolution && !hasResolvedCustomer(input)) {
    errors.phone = "請選擇符合電話及聯絡人名稱嘅現有客戶，或確認新增聯絡人";
  }
  if (!input.senderName.trim()) errors.senderName = "請輸入送花人名稱";
  if (input.recipientType === "company" && !input.recipientCompanyName.trim()) {
    errors.recipientCompanyName = "公司收貨人必須輸入公司名稱";
  }
  if (!input.recipientName.trim()) errors.recipientName = "請輸入收花人姓名";
  if (!input.recipientPhone.trim()) {
    errors.recipientPhone = "請輸入收花人電話";
  } else if (!isValidPhoneNumber(input.recipientPhone)) {
    errors.recipientPhone = "請輸入有效收花人電話";
  }
  if (!input.deliveryAddress.trim()) errors.deliveryAddress = "請輸入送貨地址";

  if (!input.deliveryDate.trim()) {
    errors.deliveryDate = "請選擇送貨日期";
  } else if (!isValidDeliveryDate(input.deliveryDate)) {
    errors.deliveryDate = "送貨日期必須是有效的 YYYY-MM-DD 日期";
  }

  if (!input.deliveryTimeMode) {
    errors.deliveryTime = "請選擇送貨時間";
  } else {
    const selectionError = validateDeliveryTimeSelection({
      deliveryDate: input.deliveryDate,
      deliveryTime: input.deliveryTime,
      deliveryTimeMode: input.deliveryTimeMode,
      deliverySlotId: input.deliverySlotId,
      slots: input.deliverySlots,
      frozenSlotSelection: input.frozenSlotSelection,
    });
    if (selectionError) errors.deliveryTime = selectionError;
  }

  return errors;
}

function hasResolvedCustomer(input: CheckoutValidationInput): boolean {
  if (input.restoredPendingSubmission) return true;

  const currentPhone = normalizePhoneNumber(input.phone);
  const currentName = normalizeCustomerIdentityName(input.customerName);
  const selectedPhone = normalizePhoneNumber(input.selectedCustomerPhone || "");
  const selectedName = normalizeCustomerIdentityName(input.selectedCustomerName || "");
  const confirmedPhone = normalizePhoneNumber(input.confirmedNewCustomerPhone || "");
  const confirmedName = normalizeCustomerIdentityName(input.confirmedNewCustomerName || "");

  return Boolean(
    currentPhone && currentName
      && (
        (selectedPhone === currentPhone && selectedName === currentName)
        || (confirmedPhone === currentPhone && confirmedName === currentName)
      )
  );
}
