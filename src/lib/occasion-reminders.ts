import type { TranslationKey } from "@/lib/i18n";

// reminderOption value used by PaymentSection (none / same_day / 1_day_before / 3_days_before / 1_week_before)
export type ReminderOption = "none" | "same_day" | "1_day_before" | "3_days_before" | "1_week_before";

export const OCCASION_KEYS: TranslationKey[] = [
  "occasion_birthday", "occasion_mothers_day", "occasion_fathers_day",
  "occasion_valentines", "occasion_christmas", "occasion_anniversary",
  "occasion_graduation", "occasion_new_year", "occasion_other",
];

const STORAGE_KEY = "florist-pos-occasion-reminders";

export type OccasionReminderMap = Record<string, ReminderOption>;

export function loadOccasionReminders(): OccasionReminderMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveOccasionReminders(map: OccasionReminderMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** Default reminder timing for an occasion, or "none" when unconfigured. */
export function reminderForOccasion(occasionTag: string): ReminderOption {
  if (!occasionTag) return "none";
  return loadOccasionReminders()[occasionTag] ?? "none";
}
