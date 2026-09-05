import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CustomerHistoryDock from "@/components/pos/CustomerHistoryDock";
import type { DemoCustomer } from "@/data/demo-customers";

vi.mock("@/components/pos/CustomerHistoryPanel", () => ({
  default: ({
    customer,
    onClose,
    inline,
  }: {
    customer: DemoCustomer;
    onClose: () => void;
    inline?: boolean;
  }) => (
    <section
      aria-label={`${customer.name} 客戶記錄面板`}
      data-inline={inline ? "true" : "false"}
    >
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

const mockDesktopDock = (matches: boolean) => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe("CustomerHistoryDock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes the inline panel without losing the selected customer and reopens it from the right rail", () => {
    mockDesktopDock(true);
    const onOpenChange = vi.fn();
    render(
      <CustomerHistoryDock
        customer={customer}
        onOpenChange={onOpenChange}
      />,
    );

    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("region", { name: "Jay 客戶記錄面板" })).toHaveAttribute(
      "data-inline",
      "true",
    );
    expect(window.matchMedia).toHaveBeenCalledWith(expect.stringContaining("orientation: landscape"));

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
    mockDesktopDock(true);
    const { rerender } = render(<CustomerHistoryDock customer={customer} />);
    fireEvent.click(screen.getByRole("button", { name: "關閉客戶記錄" }));

    rerender(
      <CustomerHistoryDock
        customer={{ ...customer, id: "customer-2", name: "May" }}
      />,
    );

    expect(screen.getByRole("region", { name: "May 客戶記錄面板" })).toBeVisible();
  });

  it("starts collapsed as a floating control on iPad without shrinking the order form", () => {
    mockDesktopDock(false);
    render(<CustomerHistoryDock customer={customer} />);

    const dock = screen.getByRole("complementary", { name: "已摺疊的客戶記錄" });
    expect(dock).toHaveClass("fixed", "bottom-24", "left-3");
    expect(dock).not.toHaveClass("w-14", "shrink-0");
    expect(screen.queryByRole("region", { name: "Jay 客戶記錄面板" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "打開 Jay 客戶記錄" }));
    expect(screen.getByRole("region", { name: "Jay 客戶記錄面板" })).toHaveAttribute(
      "data-inline",
      "false",
    );
  });
});
