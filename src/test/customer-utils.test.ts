import { describe, expect, it } from "vitest";
import { customerIdentityKey } from "@/lib/customer-utils";

describe("customerIdentityKey", () => {
  it("keeps distinct Odoo partners separate even when their phone numbers match", () => {
    expect(customerIdentityKey({ id: "odoo-11", odooPartnerId: 11 })).not.toBe(
      customerIdentityKey({ id: "odoo-12", odooPartnerId: 12 })
    );
  });

  it("uses the local id for customers that have not synced to Odoo", () => {
    expect(customerIdentityKey({ id: "local-1" })).toBe("local:local-1");
  });
});
