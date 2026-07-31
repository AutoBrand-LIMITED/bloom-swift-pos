import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CustomerHistoryDock from "@/components/pos/CustomerHistoryDock";
import type { DemoCustomer } from "@/data/demo-customers";

vi.mock("@/components/pos/CustomerHistoryPanel", () => ({
  default: ({
    customer,
    onClose,
  }: {
    customer: DemoCustomer;
    onClose: () => void;
  }) => (
    <section aria-label={`${customer.name} 客戶記錄面板`}>
      <button type="button" onClick={onClose}>關閉客戶記錄</button>
    </section>
  ),
}));

const customer: DemoCustomer = {
  id: "customer-1",
  name: "Jay",
  phone: "67610707",
  history: [],
};

describe("CustomerHistoryDock", () => {
  it("closes the panel without losing the selected customer and reopens it from the left rail", () => {
    render(<CustomerHistoryDock customer={customer} />);

    fireEvent.click(screen.getByRole("button", { name: "關閉客戶記錄" }));

    expect(screen.queryByRole("region", { name: "Jay 客戶記錄面板" })).not.toBeInTheDocument();
    const reopen = screen.getByRole("button", { name: "打開 Jay 客戶記錄" });
    expect(reopen).toBeVisible();

    fireEvent.click(reopen);

    expect(screen.getByRole("region", { name: "Jay 客戶記錄面板" })).toBeVisible();
  });

  it("opens automatically for a different selected customer", () => {
    const { rerender } = render(<CustomerHistoryDock customer={customer} />);
    fireEvent.click(screen.getByRole("button", { name: "關閉客戶記錄" }));

    rerender(
      <CustomerHistoryDock
        customer={{ ...customer, id: "customer-2", name: "May" }}
      />,
    );

    expect(screen.getByRole("region", { name: "May 客戶記錄面板" })).toBeVisible();
  });
});
