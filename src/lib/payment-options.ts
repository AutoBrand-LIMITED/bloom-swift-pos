import type { AccountingPaymentOption } from "@/lib/odoo-api";

const PAYMENT_OPTIONS_CACHE_KEY = "florist-pos-payment-options-v1";

const isPaymentOption = (value: unknown): value is AccountingPaymentOption => {
  if (!value || typeof value !== "object") return false;
  const option = value as Record<string, unknown>;
  return typeof option.code === "string"
    && option.code.trim().length > 0
    && typeof option.label === "string"
    && option.label.trim().length > 0;
};

export const loadCachedPaymentOptions = (): AccountingPaymentOption[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(PAYMENT_OPTIONS_CACHE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isPaymentOption) : [];
  } catch {
    return [];
  }
};

export const saveCachedPaymentOptions = (options: AccountingPaymentOption[]) => {
  if (typeof window === "undefined" || options.length === 0) return;
  window.localStorage.setItem(PAYMENT_OPTIONS_CACHE_KEY, JSON.stringify(options));
};

export const resolvePaymentReference = (reference: string, checkoutId: string): string => {
  const explicitReference = reference.trim();
  if (explicitReference) return explicitReference;
  return `POS-${checkoutId.slice(0, 8).toUpperCase()}`;
};
