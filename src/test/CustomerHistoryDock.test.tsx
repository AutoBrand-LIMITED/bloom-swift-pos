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
    const onOpenChange = vi.fn();
    render(
      <CustomerHistoryDock
        customer={customer}
        onOpenChange={onOpenChange}
      />,
    );

    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "關閉客戶記錄" }));

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("region", { name: "Jay 客戶記錄面板" })).not.toBeInTheDocument();
    const reopen = screen.getByRole("button", { name: "打開 Jay 客戶記錄" });
    expect(reopen).toBeVisible();

    fireEvent.click(reopen);

    expect(onOpenChange).toHaveBeenLastCalledWith(true);
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

  it("keeps the collapsed dock in the 361px mobile flex layout without covering checkout", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 361 });
    render(<CustomerHistoryDock customer={customer} />);

    fireEvent.click(screen.getByRole("button", { name: "關閉客戶記錄" }));

    const dock = screen.getByRole("complementary", { name: "已摺疊的客戶記錄" });
    expect(dock).toHaveClass("sticky", "w-14", "shrink-0");
    expect(dock).not.toHaveClass("fixed", "inset-y-0", "z-50");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});
