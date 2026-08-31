export interface RecipientBirthdayCarrier {
  recipientBirthday?: string | null;
}

export const hasRecipientBirthdayField = (value: RecipientBirthdayCarrier): boolean => (
  Object.prototype.hasOwnProperty.call(value, "recipientBirthday")
  && value.recipientBirthday !== undefined
);

export const recipientBirthdayStateFromSelection = (value: RecipientBirthdayCarrier) => ({
  value: typeof value.recipientBirthday === "string" ? value.recipientBirthday : "",
  known: hasRecipientBirthdayField(value),
});
