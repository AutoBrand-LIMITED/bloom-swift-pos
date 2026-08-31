import type { Order, RecipientOccasion, RecipientOccasionType } from "@/types/order";

export interface RecipientOccasionCarrier {
  recipientOccasions?: readonly RecipientOccasion[] | null;
  recipientOccasionsVersion?: string | null;
  recipientBirthday?: string | null;
}

export const RECIPIENT_OCCASION_LABELS: Record<RecipientOccasionType, string> = {
  birthday: "收件人生日",
  anniversary: "週年",
  valentines_day: "情人節",
  other: "其他紀念日",
};

const hasOwn = (value: RecipientOccasionCarrier, field: keyof RecipientOccasionCarrier) => (
  Object.prototype.hasOwnProperty.call(value, field) && value[field] !== undefined
);

export const ownsRecipientOccasionsField = (value: RecipientOccasionCarrier): boolean => (
  hasOwn(value, "recipientOccasions")
);

export const hasRecipientOccasionsField = (value: RecipientOccasionCarrier): boolean => (
  Array.isArray(value.recipientOccasions)
);

export const ownsRecipientOccasionsVersionField = (
  value: RecipientOccasionCarrier,
): boolean => hasOwn(value, "recipientOccasionsVersion");

export const recipientOccasionsVersionFromSelection = (
  value: RecipientOccasionCarrier,
): string | null | undefined => (
  hasRecipientOccasionsField(value) && ownsRecipientOccasionsVersionField(value)
    ? value.recipientOccasionsVersion
    : undefined
);

export const cloneRecipientOccasions = (
  occasions: readonly RecipientOccasion[],
): RecipientOccasion[] => occasions.map((occasion) => ({ ...occasion }));

export const recipientOccasionsStateFromSelection = (value: RecipientOccasionCarrier) => {
  if (hasRecipientOccasionsField(value)) {
    return {
      value: Array.isArray(value.recipientOccasions)
        ? cloneRecipientOccasions(value.recipientOccasions)
        : [],
      known: true,
      legacy: false,
    };
  }
  if (hasOwn(value, "recipientBirthday")) {
    const birthday = typeof value.recipientBirthday === "string"
      ? value.recipientBirthday.trim()
      : "";
    return {
      value: birthday ? [{ type: "birthday" as const, date: birthday }] : [],
      known: true,
      legacy: true,
    };
  }
  return { value: [], known: false, legacy: false };
};

export const normalizeRecipientOccasions = (
  occasions: readonly RecipientOccasion[],
): RecipientOccasion[] => occasions.map((occasion) => {
  const label = occasion.label?.trim();
  return {
    ...(occasion.id !== undefined ? { id: occasion.id } : {}),
    type: occasion.type,
    ...(label ? { label } : {}),
    date: occasion.date.trim(),
  };
});

const occasionsMatch = (
  left: readonly RecipientOccasion[],
  right: readonly RecipientOccasion[],
) => JSON.stringify(left) === JSON.stringify(right);

export const recipientOccasionsAreUnchanged = (
  occasions: readonly RecipientOccasion[],
  baseline: RecipientOccasionCarrier,
): boolean => occasionsMatch(
  occasions,
  recipientOccasionsStateFromSelection(baseline).value,
);

const hasLegacyBirthdayField = (value: RecipientOccasionCarrier) => (
  Object.prototype.hasOwnProperty.call(value, "recipientBirthday")
  && value.recipientBirthday !== undefined
);

export function recipientOccasionFieldsForSubmission(
  recipientOccasions: readonly RecipientOccasion[],
  recipientOccasionsKnown: boolean,
  baselineOrder?: Pick<
    Order,
    "recipientOccasions" | "recipientOccasionsVersion" | "recipientBirthday"
  >,
  recipientOccasionsVersion?: string | null,
): Pick<
  Order,
  "recipientOccasions" | "recipientOccasionsVersion" | "recipientBirthday"
> {
  if (baselineOrder) {
    const baselineState = recipientOccasionsStateFromSelection(baselineOrder);
    if (
      occasionsMatch(recipientOccasions, baselineState.value)
      && recipientOccasionsVersion === baselineOrder.recipientOccasionsVersion
    ) {
      return {
        ...(ownsRecipientOccasionsField(baselineOrder)
          ? { recipientOccasions: baselineOrder.recipientOccasions }
          : {}),
        ...(ownsRecipientOccasionsVersionField(baselineOrder)
          ? { recipientOccasionsVersion: baselineOrder.recipientOccasionsVersion }
          : {}),
        ...(hasLegacyBirthdayField(baselineOrder)
          ? { recipientBirthday: baselineOrder.recipientBirthday }
          : {}),
      };
    }
  }
  if (!recipientOccasionsKnown && recipientOccasions.length === 0) return {};
  return {
    recipientOccasions: normalizeRecipientOccasions(recipientOccasions),
    ...(recipientOccasionsVersion !== undefined
      ? { recipientOccasionsVersion }
      : {}),
  };
}

export const recipientOccasionValidationError = (
  occasions: readonly RecipientOccasion[],
  destinationLabel = "收花人",
): string | null => {
  for (let index = 0; index < occasions.length; index += 1) {
    const occasion = occasions[index];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occasion.date.trim())) {
      return `${destinationLabel}重要日子 ${index + 1} 請選擇有效日期。`;
    }
    if (occasion.type === "other" && !occasion.label?.trim()) {
      return `${destinationLabel}重要日子 ${index + 1} 請輸入自訂名稱。`;
    }
  }
  return null;
};

export const formatRecipientOccasions = (carrier: RecipientOccasionCarrier): string => (
  recipientOccasionsStateFromSelection(carrier).value.map((occasion) => (
    `${occasion.type === "other" && occasion.label?.trim()
      ? occasion.label.trim()
      : RECIPIENT_OCCASION_LABELS[occasion.type]}：${occasion.date}`
  )).join("\n")
);
