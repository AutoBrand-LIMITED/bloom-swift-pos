import type { RecipientSuggestion } from "@/lib/odoo-api";

export interface RecipientBindingResolution {
  selection: RecipientSuggestion;
  copiedToCurrentCustomer: boolean;
}

/**
 * Odoo shipping contacts belong to one ordering customer. Reusing the visible
 * recipient details under another customer is allowed, but the foreign partner
 * ID, optimistic-lock version and occasion row IDs must not cross that boundary.
 */
export const resolveRecipientSuggestionForCustomer = (
  suggestion: RecipientSuggestion,
  currentCustomerId?: number,
): RecipientBindingResolution => {
  if (!suggestion.shippingPartnerId) {
    return { selection: suggestion, copiedToCurrentCustomer: false };
  }

  const belongsToCurrentCustomer = suggestion.orderingCustomerId !== null
    ? suggestion.orderingCustomerId === currentCustomerId
    : suggestion.shippingPartnerId === currentCustomerId;
  if (belongsToCurrentCustomer) {
    return { selection: suggestion, copiedToCurrentCustomer: false };
  }

  const {
    recipientOccasionsVersion: _recipientOccasionsVersion,
    ...detached
  } = suggestion;
  return {
    selection: {
      ...detached,
      shippingPartnerId: null,
      ...(suggestion.recipientOccasions !== undefined
        ? {
            recipientOccasions: suggestion.recipientOccasions?.map((occasion) => {
              const { id: _id, ...copy } = occasion;
              return copy;
            }) ?? suggestion.recipientOccasions,
          }
        : {}),
    },
    copiedToCurrentCustomer: true,
  };
};
