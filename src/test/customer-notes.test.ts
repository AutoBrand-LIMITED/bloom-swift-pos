import { describe, expect, it } from "vitest";
import {
  appendPersistentNote,
  buildPartnerNoteMutation,
  getManagedCustomerFlags,
} from "@/lib/customer-notes";

describe("customer note helpers", () => {
  it("appends an order note without duplicating the same persistent note", () => {
    expect(appendPersistentNote("Existing", "New note")).toBe("Existing\n\nNew note");
    expect(appendPersistentNote("Existing\n\nNew note", "New note")).toBe("Existing\n\nNew note");
  });

  it("keeps managed flags read-only and excludes unrelated CRM tags from display", () => {
    expect(getManagedCustomerFlags([
      { id: 1, name: "VIP", managed: true },
      { id: 2, name: "Wholesale", managed: false },
    ])).toEqual([{ id: 1, name: "VIP", managed: true }]);
  });

  it("creates a deferred mutation for a brand-new contact", () => {
    expect(buildPartnerNoteMutation({ draft: "New customer note" })).toEqual({
      commentText: "New customer note",
    });
  });

  it("binds existing contacts to their Odoo version and supports clearing", () => {
    expect(buildPartnerNoteMutation({
      draft: "",
      currentComment: "Old note",
      targetPartnerId: 42,
      expectedWriteDate: "2026-07-16 10:00:00",
    })).toEqual({
      commentText: "",
      targetPartnerId: 42,
      expectedWriteDate: "2026-07-16 10:00:00",
    });
  });

  it("appends an order note once and omits unchanged values", () => {
    expect(buildPartnerNoteMutation({
      draft: "Permanent",
      currentComment: "Permanent",
      appendNote: "Call first",
      shouldAppend: true,
    })).toEqual({ commentText: "Permanent\n\nCall first" });
    expect(buildPartnerNoteMutation({
      draft: "Permanent",
      currentComment: "Permanent",
    })).toBeUndefined();
  });
});
