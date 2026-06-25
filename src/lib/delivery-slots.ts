import type { TranslationKey } from "@/lib/i18n";

export interface DeliverySlot {
  id: string;
  value: string; // canonical string stored on the order
  label: string; // display label (used for custom slots)
  sublabel: string;
  labelKey?: TranslationKey; // i18n key for built-in slots (overrides label)
  sublabelKey?: TranslationKey;
  specified?: boolean; // triggers the time picker; cannot be removed
  locked?: boolean; // built-in slot — value not editable
}

const SLOTS_STORAGE_KEY = "florist-pos-slots";

export const DEFAULT_SLOTS: DeliverySlot[] = [
  { id: "morning", value: "上午 (9–1pm)", label: "上午", labelKey: "slot_morning_label", sublabel: "9am – 1pm", locked: true },
  { id: "afternoon", value: "下午 (1–6pm)", label: "下午", labelKey: "slot_afternoon_label", sublabel: "1pm – 6pm", locked: true },
  { id: "specified", value: "指定時間", label: "指定時間", labelKey: "slot_specified_label", sublabel: "+ 附加費", sublabelKey: "slot_specified_sub", specified: true, locked: true },
];

export function loadSlots(): DeliverySlot[] {
  try {
    const raw = localStorage.getItem(SLOTS_STORAGE_KEY);
    if (!raw) return DEFAULT_SLOTS;
    const parsed = JSON.parse(raw) as DeliverySlot[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SLOTS;
    // Strip `specified` and `locked` from custom slots — only built-in slots
    // may carry these flags. Prevents crafted localStorage from injecting them.
    const sanitized = parsed.map(s => s.locked ? s : { ...s, specified: false, locked: false });
    // Guarantee the specified slot always exists (it drives the time picker)
    if (!sanitized.some(s => s.specified)) {
      return [...sanitized, DEFAULT_SLOTS.find(s => s.specified)!];
    }
    return sanitized;
  } catch {
    return DEFAULT_SLOTS;
  }
}

export function saveSlots(slots: DeliverySlot[]): void {
  localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(slots));
}

export function resetSlots(): void {
  localStorage.removeItem(SLOTS_STORAGE_KEY);
}
