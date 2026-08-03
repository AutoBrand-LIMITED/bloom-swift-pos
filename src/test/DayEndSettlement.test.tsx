import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrderTable } from "@/pages/DayEndSettlement";
import type { DayEndOrderRow } from "@/lib/odoo-api";

const order: DayEndOrderRow = {
  id: 1,
  orderName: "S17785",
  invoiceReference: "POS-001",
  posLocalId: "local-001",
  dateOrder: "2026-08-03 10:01",
  customerName: "Jay",
  salesperson: "Testing — T001",
  paymentStatus: "unpaid",
  paymentMethod: null,
  paymentBucket: "unmapped",
  saleTotal: 1111,
  receivedToday: 0,
  depositAmount: 0,
  balanceAmount: 1111,
  remarks: null,
  deliveryDate: "2026-08-04",
  recipientType: "personal",
  recipientCompanyName: null,
  recipientName: "Ng",
  recipientPhone: "67610707",
  deliveryAddress: "觀塘巧明街",
};

describe("DayEndSettlement order table", () => {
  it("shows the employee or sales identity for every order", () => {
    render(<OrderTable orders={[order]} />);

    expect(screen.getByRole("columnheader", { name: "落單員工／Sales" })).toBeVisible();
    expect(screen.getByText("Testing — T001")).toBeVisible();
  });
});
