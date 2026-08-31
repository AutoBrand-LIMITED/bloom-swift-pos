import { describe, expect, it } from "vitest";

import { resolveRecipientSuggestionForCustomer } from "@/lib/recipient-binding";
import type { RecipientSuggestion } from "@/lib/odoo-api";

const suggestion = (overrides: Partial<RecipientSuggestion> = {}): RecipientSuggestion => ({
  id: 91,
  recipientType: "personal",
  recipientCompanyName: null,
  recipientName: "Ms Gift",
  recipientPhone: "61234567",
  recipientOccasions: [{ id: 7, type: "birthday", date: "1990-01-02" }],
  recipientOccasionsVersion: "a".repeat(64),
  deliveryAddress: "九龍觀塘巧明街 6 號",
  shippingPartnerId: 85,
  orderingCustomerId: 42,
  orderingCustomerName: "Customer 42",
  orderingCustomerPhone: "61234567",
  orderingCustomerEmail: null,
  orderingCustomerBillingAddress: null,
  ...overrides,
});

describe("resolveRecipientSuggestionForCustomer", () => {
  it("keeps the Odoo binding when the recipient belongs to the selected customer", () => {
    const original = suggestion();
    const result = resolveRecipientSuggestionForCustomer(original, 42);

    expect(result).toEqual({ selection: original, copiedToCurrentCustomer: false });
  });

  it("copies visible details without foreign Odoo identity fields", () => {
    const result = resolveRecipientSuggestionForCustomer(suggestion(), 99);

    expect(result.copiedToCurrentCustomer).toBe(true);
    expect(result.selection).toMatchObject({
      recipientName: "Ms Gift",
      recipientPhone: "61234567",
      shippingPartnerId: null,
      recipientOccasions: [{ type: "birthday", date: "1990-01-02" }],
    });
    expect(result.selection).not.toHaveProperty("recipientOccasionsVersion");
    expect(result.selection.recipientOccasions?.[0]).not.toHaveProperty("id");
  });

  it("detaches a bound recipient when no existing customer is selected", () => {
    expect(resolveRecipientSuggestionForCustomer(suggestion(), undefined))
      .toMatchObject({ copiedToCurrentCustomer: true, selection: { shippingPartnerId: null } });
  });

  it("leaves an already unbound historical snapshot unchanged", () => {
    const original = suggestion({ shippingPartnerId: null, recipientOccasionsVersion: undefined });
    expect(resolveRecipientSuggestionForCustomer(original, 99))
      .toEqual({ selection: original, copiedToCurrentCustomer: false });
  });
});
