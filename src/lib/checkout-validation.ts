import {
  validateDeliveryTimeSelection,
  type FrozenDeliverySlotSelection,
} from "@/lib/delivery-slots";
import type { DeliverySlot } from "@/lib/odoo-api";
import type { DeliveryTimeMode } from "@/types/order";

export type CheckoutField =
  | "customerName"
  | "phone"
  | "senderName"
  | "recipientName"
  | "recipientPhone"
  | "deliveryAddress"
  | "deliveryDate"
  | "deliveryTime";

export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

interface CheckoutValidationInput {
  customerName: string;
  phone: string;
  selectedCustomerPhone?: string;
  confirmedNewCustomerPhone?: string | null;
  restoredPendingSubmission?: boolean;
  requiresCustomerResolution?: boolean;
  senderName: string;
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

export function validateCheckout(input: CheckoutValidationInput): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (!input.customerName.trim()) errors.customerName = "請輸入下單人／聯絡人名稱";
  if (!input.phone.trim()) {
    errors.phone = "請輸入下單人電話";
  } else if (!isValidPhoneNumber(input.phone)) {
    errors.phone = "請輸入有效電話號碼";
  } else if (input.requiresCustomerResolution && !hasResolvedCustomer(input)) {
    errors.phone = "請先搜尋並選擇現有客戶，或確認新增客戶";
  }
  if (!input.senderName.trim()) errors.senderName = "請輸入送花人名稱";
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
  const selectedPhone = normalizePhoneNumber(input.selectedCustomerPhone || "");
  const confirmedPhone = normalizePhoneNumber(input.confirmedNewCustomerPhone || "");

  return Boolean(
    currentPhone
      && (
        (selectedPhone && selectedPhone === currentPhone)
        || (confirmedPhone && confirmedPhone === currentPhone)
      )
  );
}
